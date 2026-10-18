"""Normalizadores de ingesta."""

from ingestion.normalizers.base import NormalizationResult, Normalizer
from ingestion.normalizers.igp import IgpNormalizer

__all__ = ["NormalizationResult", "Normalizer", "IgpNormalizer"]
