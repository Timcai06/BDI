from __future__ import annotations

import torch
import torch.nn as nn

from .blocks import ResBlock


class Generator(nn.Module):
    """
    Revised generator for DEvUDP perceptual mode:
    - input / output range: [-1, 1]
    - InstanceNorm by default
    - no global shortcut by default
    - 2 downsample + N residual blocks + 2 upsample
    - extra high-resolution refinement blocks before final output
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
    ) -> None:
        super().__init__()
        norm = "in" if use_instance_norm else "bn"
        self.use_global_shortcut = use_global_shortcut

        norm_layer = nn.InstanceNorm2d if use_instance_norm else nn.BatchNorm2d

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
        if self.use_global_shortcut:
            out = torch.clamp(out + x, min=-1.0, max=1.0)
        return out
