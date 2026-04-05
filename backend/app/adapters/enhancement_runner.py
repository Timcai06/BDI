from __future__ import annotations

import gc
import logging
from pathlib import Path
from typing import Optional

import torch
import torch.nn.functional as F
from PIL import Image
from torchvision.transforms import functional as TF
import numpy as np

from app.adapters.enhancement.devudp_revised.models.generator import Generator as RevisedGenerator
from app.adapters.enhancement.devudp_bridge.models.generator import Generator as BridgeGenerator

logger = logging.getLogger(__name__)

class DualBranchEnhanceRunner:
    """
    Runner for dual-branch image enhancement (Revised + Bridge).
    Fuses results from two generators to produce a high-quality enhanced image.
    """

    def __init__(
        self,
        revised_weights_path: str | Path,
        bridge_weights_path: str | Path,
        device: str = "cpu",
        max_side: int = 1024,
    ) -> None:
        self.revised_weights_path = Path(revised_weights_path)
        self.bridge_weights_path = Path(bridge_weights_path)
        self.device = torch.device(device if torch.cuda.is_available() and device.startswith("cuda") else "cpu")
        self.max_side = max_side
        
        # Bridge specific parameters from original infer.py
        self.bridge_alpha = 0.78
        self.bridge_blur_kernel = 5
        self.bridge_blur_sigma = 1.0
        self.bridge_edge_gain = 2.2
        self.bridge_edge_threshold = 0.12

        logger.info("Loading enhancement models onto %s", self.device)
        self.revised_G = self._load_revised(self.revised_weights_path)
        self.bridge_G = self._load_bridge(self.bridge_weights_path)
        logger.info("Enhancement models loaded successfully")

    def describe(self) -> dict[str, str]:
        return {
            "algorithm": "Img_Enhance",
            "pipeline": "dual_branch_fusion",
            "revised_weights": self.revised_weights_path.name,
            "bridge_weights": self.bridge_weights_path.name,
        }

    def _load_revised(self, path: Path) -> RevisedGenerator:
        ckpt = torch.load(path, map_location=self.device)
        cfg = ckpt.get("config", {}).get("model", {})
        
        G = RevisedGenerator(
            in_channels=cfg.get("in_channels", 3),
            out_channels=cfg.get("out_channels", 3),
            base_channels=cfg.get("base_channels", 64),
            num_res_blocks=cfg.get("num_res_blocks", 6),
            use_instance_norm=cfg.get("use_instance_norm", True),
            use_global_shortcut=cfg.get("use_global_shortcut", False),
            num_refine_blocks=cfg.get("num_refine_blocks", 2),
        ).to(self.device)
        
        G.load_state_dict(ckpt["G"], strict=True)
        G.eval()
        return G

    def _load_bridge(self, path: Path) -> BridgeGenerator:
        ckpt = torch.load(path, map_location=self.device)
        cfg = ckpt.get("config", {}).get("model", {})
        
        G = BridgeGenerator(
            in_channels=cfg.get("in_channels", 3),
            out_channels=cfg.get("out_channels", 3),
            base_channels=cfg.get("base_channels", 64),
            num_res_blocks=cfg.get("num_res_blocks", 6),
            use_instance_norm=cfg.get("use_instance_norm", True),
            use_global_shortcut=cfg.get("use_global_shortcut", False),
            num_refine_blocks=cfg.get("num_refine_blocks", 2),
            predict_residual=cfg.get("predict_residual", True),
            residual_scale=cfg.get("residual_scale", 0.8),
        ).to(self.device)
        
        state_key = "G_ema" if "G_ema" in ckpt else "G"
        G.load_state_dict(ckpt[state_key], strict=True)
        G.eval()
        return G

    @torch.no_grad()
    def enhance(self, img: Image.Image) -> Image.Image:
        """
        Main entry point for enhancing a single PIL image.
        Returns the fused result from both branches.
        """
        orig_w, orig_h = img.size
        img_rgb = img.convert("RGB")
        
        # Step 1: Run Revised Branch
        revised_out = self._run_branch_safely(
            self.revised_G, 
            img_rgb, 
            mode="revised"
        )
        
        # Step 2: Run Bridge Branch
        bridge_out = self._run_branch_safely(
            self.bridge_G, 
            img_rgb, 
            mode="bridge"
        )
        
        # Step 3: Fuse Results
        fused = self._fuse_average(revised_out, bridge_out)
        
        # Restore original size if scaled
        if fused.size != (orig_w, orig_h):
            fused = fused.resize((orig_w, orig_h), Image.BICUBIC)
            
        return fused

    def _run_branch_safely(self, G: torch.nn.Module, img: Image.Image, mode: str) -> Image.Image:
        """Runs a branch with OOM protection (reduces size if needed)."""
        last_error = None
        # Try max_side first, then fallback to 768 as in original infer.py
        for size in [self.max_side, 768, 512]:
            try:
                if mode == "revised":
                    return self._run_revised_core(G, img, size)
                else:
                    return self._run_bridge_core(G, img, size)
            except torch.OutOfMemoryError as e:
                last_error = e
                if self.device.type == "cuda":
                    torch.cuda.empty_cache()
                gc.collect()
                logger.warning("OOM in %s branch at size %d, retrying smaller...", mode, size)
        
        raise RuntimeError(f"Enhancement failed due to persistent OOM in {mode} branch: {last_error}")

    def _run_revised_core(self, G: RevisedGenerator, img: Image.Image, size: int) -> Image.Image:
        resized_img = self._resize_if_needed(img, size)
        x = self._to_tensor(resized_img).unsqueeze(0).to(self.device)
        
        with torch.amp.autocast(device_type=self.device.type, enabled=self.device.type == "cuda"):
            pred = G(x)[0].clamp(-1.0, 1.0)
            
        return self._tensor_to_pil(pred)

    def _run_bridge_core(self, G: BridgeGenerator, img: Image.Image, size: int) -> Image.Image:
        resized_img = self._resize_if_needed(img, size)
        x = self._to_tensor(resized_img).unsqueeze(0).to(self.device)
        
        with torch.amp.autocast(device_type=self.device.type, enabled=self.device.type == "cuda"):
            pred = G(x).clamp(-1.0, 1.0)
            
            # Bridge specific refinements
            residual = pred - x
            residual_smooth = self._gaussian_blur(
                residual, 
                kernel_size=self.bridge_blur_kernel, 
                sigma=self.bridge_blur_sigma
            )
            
            edge_mask = self._compute_edge_mask(
                x, 
                edge_gain=self.bridge_edge_gain, 
                edge_threshold=self.bridge_edge_threshold
            )
            
            fused_residual = (1.0 - edge_mask) * residual_smooth + edge_mask * residual
            refined = (x + self.bridge_alpha * fused_residual).clamp(-1.0, 1.0)
            
        return self._tensor_to_pil(refined[0])

    def _resize_if_needed(self, img: Image.Image, max_side: int) -> Image.Image:
        w, h = img.size
        long_side = max(w, h)
        if long_side <= max_side:
            return img
        scale = max_side / long_side
        return img.resize((int(w * scale), int(h * scale)), Image.BICUBIC)

    def _to_tensor(self, img: Image.Image) -> torch.Tensor:
        return TF.to_tensor(img) * 2.0 - 1.0

    def _tensor_to_pil(self, t: torch.Tensor) -> Image.Image:
        t = t.detach().cpu().float().clamp(-1.0, 1.0)
        t = (t + 1.0) / 2.0
        return TF.to_pil_image(t)

    def _fuse_average(self, img1: Image.Image, img2: Image.Image) -> Image.Image:
        a1 = np.array(img1, dtype=np.float32)
        a2 = np.array(img2, dtype=np.float32)
        fused = np.clip(0.5 * a1 + 0.5 * a2, 0, 255).astype(np.uint8)
        return Image.fromarray(fused)

    def _gaussian_blur(self, x: torch.Tensor, kernel_size: int, sigma: float) -> torch.Tensor:
        if kernel_size <= 1: return x
        if kernel_size % 2 == 0: kernel_size += 1
        
        radius = kernel_size // 2
        coords = torch.arange(-radius, radius + 1, dtype=x.dtype, device=x.device)
        kernel_1d = torch.exp(-(coords**2) / (2 * sigma**2))
        kernel_1d /= kernel_1d.sum()
        kernel_2d = torch.outer(kernel_1d, kernel_1d).view(1, 1, kernel_size, kernel_size)
        kernel_2d = kernel_2d.repeat(x.shape[1], 1, 1, 1)
        
        return F.conv2d(x, kernel_2d, padding=radius, groups=x.shape[1])

    def _compute_edge_mask(self, x: torch.Tensor, edge_gain: float, edge_threshold: float) -> torch.Tensor:
        # Grayscale
        gray = 0.299 * x[:, 0:1] + 0.587 * x[:, 1:2] + 0.114 * x[:, 2:3]
        
        # Sobel filters
        sx = torch.tensor([[1, 0, -1], [2, 0, -2], [1, 0, -1]], dtype=x.dtype, device=x.device).view(1, 1, 3, 3)
        sy = torch.tensor([[1, 2, 1], [0, 0, 0], [-1, -2, -1]], dtype=x.dtype, device=x.device).view(1, 1, 3, 3)
        
        gx = F.conv2d(gray, sx, padding=1)
        gy = F.conv2d(gray, sy, padding=1)
        grad = torch.sqrt(gx**2 + gy**2 + 1e-6)
        
        grad /= (grad.mean(dim=(-2, -1), keepdim=True) + 1e-6)
        return torch.clamp((grad - edge_threshold) * edge_gain, 0.0, 1.0)
