"""Unit tests for the metrics calculator module."""

import pytest
from app.core.metrics_calculator import (
    calculate_polygon_area,
    calculate_max_length,
    calculate_crack_width_from_polygon,
    calculate_metrics_from_mask,
    PhysicalMetrics,
)


class TestPolygonArea:
    """Tests for polygon area calculation."""

    def test_square_area(self):
        """Test area calculation for a square."""
        points = [[0, 0], [10, 0], [10, 10], [0, 10]]
        area = calculate_polygon_area(points)
        assert area == 100.0

    def test_rectangle_area(self):
        """Test area calculation for a rectangle."""
        points = [[0, 0], [20, 0], [20, 10], [0, 10]]
        area = calculate_polygon_area(points)
        assert area == 200.0

    def test_triangle_area(self):
        """Test area calculation for a triangle."""
        points = [[0, 0], [10, 0], [5, 10]]
        area = calculate_polygon_area(points)
        assert area == 50.0

    def test_empty_polygon(self):
        """Test area of empty polygon."""
        area = calculate_polygon_area([])
        assert area == 0.0

    def test_two_points(self):
        """Test area with only 2 points."""
        area = calculate_polygon_area([[0, 0], [10, 10]])
        assert area == 0.0


class TestMaxLength:
    """Tests for maximum length calculation."""

    def test_horizontal_line(self):
        """Test length of horizontal line."""
        points = [[0, 0], [100, 0]]
        length = calculate_max_length(points)
        assert length == 100.0

    def test_diagonal_line(self):
        """Test length of diagonal line."""
        points = [[0, 0], [30, 40]]  # 3-4-5 triangle
        length = calculate_max_length(points)
        assert length == 50.0

    def test_polygon_max_diameter(self):
        """Test max diameter in a polygon."""
        # Diamond shape: furthest points are (0,5) and (0,-5)
        points = [[0, 5], [5, 0], [0, -5], [-5, 0]]
        length = calculate_max_length(points)
        assert length == 10.0

    def test_single_point(self):
        """Test with single point."""
        length = calculate_max_length([[0, 0]])
        assert length == 0.0


class TestCrackWidth:
    """Tests for crack width calculation."""

    def test_thin_crack(self):
        """Test width calculation for thin crack."""
        # Long thin crack
        points = [[0, 0], [100, 0], [100, 2], [0, 2]]
        length = 100.0
        width = calculate_crack_width_from_polygon(points, length)
        # Area should be ~200, width ≈ (2*200)/100 = 4
        assert 3 < width < 5

    def test_wide_crack(self):
        """Test width calculation for wide crack."""
        # Wider crack
        points = [[0, 0], [50, 0], [50, 10], [0, 10]]
        length = 50.0
        width = calculate_crack_width_from_polygon(points, length)
        # Area = 500, width ≈ (2*500)/50 = 20
        assert 18 < width < 22


class TestMetricsFromMask:
    """Tests for complete metrics calculation."""

    def test_crack_metrics(self):
        """Test metrics for a crack-like shape."""
        # Simulate a crack: 100 pixels long, 2 pixels wide
        points = [[10, 10], [110, 10], [110, 12], [10, 12]]

        # With pixels_per_mm = 10 (10 pixels = 1mm)
        metrics = calculate_metrics_from_mask(points, pixels_per_mm=10.0)

        assert metrics.length_mm is not None
        assert metrics.width_mm is not None
        assert metrics.area_mm2 is not None

        # Length ≈ 10mm (100 pixels / 10)
        assert 9 < metrics.length_mm < 11

        # Width calculation uses area/length formula: (2*200)/100 = 4 pixels = 0.4mm
        # This is an approximation of average width
        assert 0.3 < metrics.width_mm < 0.5

        # Area = 200 pixels = 2 mm²
        assert 1.8 < metrics.area_mm2 < 2.2

    def test_spalling_metrics(self):
        """Test metrics for spalling (block-like defect)."""
        # Simulate spalling: 50x30 pixel block
        points = [[100, 100], [150, 100], [150, 130], [100, 130]]

        metrics = calculate_metrics_from_mask(points, pixels_per_mm=10.0)

        assert metrics.has_any_metric

        # Area = 50 * 30 = 1500 pixels = 15 mm²
        assert 14 < metrics.area_mm2 < 16

    def test_empty_mask(self):
        """Test with empty mask points."""
        metrics = calculate_metrics_from_mask([])

        assert metrics.length_mm is None
        assert metrics.width_mm is None
        assert metrics.area_mm2 is None

    def test_small_defect(self):
        """Test with small defect."""
        # Small square: 10x10 pixels
        points = [[0, 0], [10, 0], [10, 10], [0, 10]]

        metrics = calculate_metrics_from_mask(points, pixels_per_mm=10.0)

        # Area = 100 pixels = 1 mm²
        assert 0.9 < metrics.area_mm2 < 1.1
