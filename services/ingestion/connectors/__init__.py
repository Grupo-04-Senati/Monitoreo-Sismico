"""Conectores de ingesta."""

from ingestion.connectors.base import Connector, ConnectorError, RawRecord
from ingestion.connectors.pendiente import PendienteConnector

__all__ = ["Connector", "ConnectorError", "RawRecord", "PendienteConnector"]
