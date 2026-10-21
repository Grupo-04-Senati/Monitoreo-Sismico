"""Normalizadores de ingesta."""

from ingestion.normalizers.base import NormalizationResult, Normalizer
from ingestion.normalizers.igp import IgpNormalizer
from ingestion.normalizers.usgs import UsgsNormalizer

__all__ = ["NormalizationResult", "Normalizer", "IgpNormalizer", "UsgsNormalizer"]
