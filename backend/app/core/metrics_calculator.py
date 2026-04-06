"""Metrics calculation module for bridge defect quantification.

This module calculates physical measurements (length, width, area) from
segmentation mask polygons, converting from pixel coordinates to physical units.

Formula reference:
- Area: Shoelace formula for polygon area
- Length: Maximum distance between any two points (Feret diameter)
- Width: Average thickness perpendicular to the length axis
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import List

import numpy as np


@dataclass
class PhysicalMetrics:
    """Physical measurements in millimeters."""

    length_mm: float | None = None
    width_mm: float | None = None
    area_mm2: float | None = None

    @property
    def has_any_metric(self) -> bool:
        return any(v is not None for v in [self.length_mm, self.width_mm, self.area_mm2])


def calculate_polygon_area(points: List[List[float]]) -> float:
    """Calculate polygon area using Shoelace formula.

    Args:
        points: List of [x, y] coordinate pairs

    Returns:
        Area in square pixels
    """
    if len(points) < 3:
        return 0.0

    n = len(points)
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += points[i][0] * points[j][1]
        area -= points[j][0] * points[i][1]

    return abs(area) / 2.0


def calculate_max_length(points: List[List[float]]) -> float:
    """Calculate maximum distance between any two points (max Feret diameter).

    For cracks, this represents the total crack length.

    Args:
        points: List of [x, y] coordinate pairs

    Returns:
        Maximum distance in pixels
    """
    if len(points) < 2:
        return 0.0

    max_dist = 0.0
    for i in range(len(points)):
        for j in range(i + 1, len(points)):
            dx = points[i][0] - points[j][0]
            dy = points[i][1] - points[j][1]
            dist = math.sqrt(dx * dx + dy * dy)
            max_dist = max(max_dist, dist)

    return max_dist


def calculate_max_width(points: List[List[float]]) -> float:
    """Calculate maximum width of the defect.

    Uses the minimum bounding rectangle approach:
    1. Find the longest diameter (length)
    2. For each edge, calculate the perpendicular distance to the opposite edge

    For cracks, this represents the maximum crack width.

    Args:
        points: List of [x, y] coordinate pairs

    Returns:
        Maximum width in pixels
    """
    if len(points) < 3:
        return 0.0

    # Convert to numpy array for easier computation
    pts = np.array(points, dtype=np.float64)

    # Calculate centroid
    centroid = np.mean(pts, axis=0)

    # Calculate distances from centroid to each point
    distances = np.linalg.norm(pts - centroid, axis=1)

    # Use a portion of the max distance as width estimate
    # This is a simplified approach; for more accuracy,
    # use convex hull and minimum bounding rectangle
    return float(np.mean(distances) * 2) if len(distances) > 0 else 0.0


def calculate_crack_width_from_polygon(points: List[List[float]], length: float) -> float:
    """Calculate average crack width based on area and length.

    For linear defects like cracks:
    width ≈ (2 * area) / length

    This gives the average width perpendicular to the crack direction.

    Args:
        points: List of [x, y] coordinate pairs
        length: Maximum crack length in pixels

    Returns:
        Average width in pixels
    """
    if length < 1.0:
        return 0.0

    area = calculate_polygon_area(points)
    # Approximate width as twice the area divided by length
    # (assuming the crack can be approximated as a parallelogram)
    avg_width = (2 * area) / length if length > 0 else 0.0

    return min(avg_width, length)  # Width should never exceed length


def calculate_metrics_from_mask(
    mask_points: List[List[float]],
    pixels_per_mm: float = 1.0,
) -> PhysicalMetrics:
    """Calculate physical metrics from a segmentation mask polygon.

    Args:
        mask_points: Polygon points from segmentation mask (in pixels)
        pixels_per_mm: Conversion factor (pixels per millimeter)

    Returns:
        PhysicalMetrics with length, width, and area in mm

    Example:
        >>> points = [[100, 100], [200, 100], [200, 105], [100, 105]]
        >>> metrics = calculate_metrics_from_mask(points, pixels_per_mm=10.0)
        >>> print(f"Length: {metrics.length_mm}mm, Area: {metrics.area_mm2}mm²")
    """
    if not mask_points or len(mask_points) < 3:
        return PhysicalMetrics()

    # Calculate in pixel space
    area_pixels = calculate_polygon_area(mask_points)
    length_pixels = calculate_max_length(mask_points)

    # Calculate width for linear defects (cracks)
    width_pixels = calculate_crack_width_from_polygon(mask_points, length_pixels)

    # Convert to physical units (mm)
    if pixels_per_mm > 0:
        length_mm = length_pixels / pixels_per_mm
        width_mm = width_pixels / pixels_per_mm
        area_mm2 = area_pixels / (pixels_per_mm**2)
    else:
        length_mm = length_pixels
        width_mm = width_pixels
        area_mm2 = area_pixels

    return PhysicalMetrics(
        length_mm=round(length_mm, 2),
        width_mm=round(width_mm, 2),
        area_mm2=round(area_mm2, 2),
    )


def calculate_mask_metrics_batch(
    masks: List[List[List[float]]],
    pixels_per_mm: float = 1.0,
) -> List[PhysicalMetrics]:
    """Calculate metrics for multiple masks.

    Args:
        masks: List of polygon point lists
        pixels_per_mm: Conversion factor (pixels per millimeter)

    Returns:
        List of PhysicalMetrics, one per mask
    """
    return [calculate_metrics_from_mask(mask, pixels_per_mm) for mask in masks]
