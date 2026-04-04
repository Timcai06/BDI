from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F

from .blocks import ResBlock


class Generator(nn.Module):
    """
    Bridge generator:
    - 2 downsample + N residual blocks + 2 upsample
    - high-resolution refinement blocks
    - residual prediction by default to reduce over-sharpening / over-rewrite
    - robust to odd-sized inputs via spatial alignment before residual addition
    """

    def __init__(
        self,
        in_channels: int = 3,
        out_channels: int = 3,
        base_channels: int = 64,
        num_res_blocks: int = 6,
        use_instance_norm: bool = True,
        use_global_shortcut: bool = False,
        num_refine_blocks: int = 2,
        predict_residual: bool = True,
        residual_scale: float = 0.8,
    ) -> None:
        super().__init__()
        norm = "in" if use_instance_norm else "bn"
        norm_layer = nn.InstanceNorm2d if use_instance_norm else nn.BatchNorm2d

        self.use_global_shortcut = use_global_shortcut
        self.predict_residual = predict_residual
        self.residual_scale = residual_scale

        self.stem = nn.Sequential(
            nn.ReflectionPad2d(3),
            nn.Conv2d(in_channels, base_channels, kernel_size=7, padding=0, bias=False),
            norm_layer(base_channels, affine=True),
            nn.ReLU(inplace=True),
        )

        self.down1 = nn.Sequential(
            nn.Conv2d(base_channels, base_channels * 2, kernel_size=3, stride=2, padding=1, bias=False),
            norm_layer(base_channels * 2, affine=True),
            nn.ReLU(inplace=True),
        )
        self.down2 = nn.Sequential(
            nn.Conv2d(base_channels * 2, base_channels * 4, kernel_size=3, stride=2, padding=1, bias=False),
            norm_layer(base_channels * 4, affine=True),
            nn.ReLU(inplace=True),
        )

        self.body = nn.Sequential(*[ResBlock(base_channels * 4, norm=norm) for _ in range(num_res_blocks)])

        self.up1 = nn.Sequential(
            nn.ConvTranspose2d(
                base_channels * 4,
                base_channels * 2,
                kernel_size=3,
                stride=2,
                padding=1,
                output_padding=1,
                bias=False,
            ),
            norm_layer(base_channels * 2, affine=True),
            nn.ReLU(inplace=True),
        )
        self.up2 = nn.Sequential(
            nn.ConvTranspose2d(
                base_channels * 2,
                base_channels,
                kernel_size=3,
                stride=2,
                padding=1,
                output_padding=1,
                bias=False,
            ),
            norm_layer(base_channels, affine=True),
            nn.ReLU(inplace=True),
        )

        refine_layers = []
        for _ in range(num_refine_blocks):
            refine_layers.extend(
                [
                    nn.ReflectionPad2d(1),
                    nn.Conv2d(base_channels, base_channels, kernel_size=3, padding=0, bias=False),
                    norm_layer(base_channels, affine=True),
                    nn.ReLU(inplace=True),
                ]
            )
        self.refine = nn.Sequential(*refine_layers)

        self.head = nn.Sequential(
            nn.ReflectionPad2d(3),
            nn.Conv2d(base_channels, out_channels, kernel_size=7, padding=0),
            nn.Tanh(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        feat = self.stem(x)
        feat = self.down1(feat)
        feat = self.down2(feat)
        feat = self.body(feat)
        feat = self.up1(feat)
        feat = self.up2(feat)
        feat = self.refine(feat)
        out = self.head(feat)

        if out.shape[-2:] != x.shape[-2:]:
            out = F.interpolate(out, size=x.shape[-2:], mode="bilinear", align_corners=False)

        if self.predict_residual:
            out = x + self.residual_scale * out

        if self.use_global_shortcut:
            out = out + x

        return torch.clamp(out, min=-1.0, max=1.0)
