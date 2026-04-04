from __future__ import annotations

import torch
import torch.nn as nn


class ResBlock(nn.Module):
    def __init__(self, channels: int, norm: str = "in") -> None:
        super().__init__()
        if norm == "in":
            norm_layer = nn.InstanceNorm2d
        elif norm == "bn":
            norm_layer = nn.BatchNorm2d
        else:
            raise ValueError(f"Unsupported norm: {norm}")

        self.block = nn.Sequential(
            nn.ReflectionPad2d(1),
            nn.Conv2d(channels, channels, kernel_size=3, padding=0, bias=False),
            norm_layer(channels, affine=True),
            nn.ReLU(inplace=True),
            nn.ReflectionPad2d(1),
            nn.Conv2d(channels, channels, kernel_size=3, padding=0, bias=False),
            norm_layer(channels, affine=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x + self.block(x)
