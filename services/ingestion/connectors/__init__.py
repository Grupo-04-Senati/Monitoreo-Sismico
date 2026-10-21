"""Conectores de ingesta."""

from ingestion.connectors.base import Connector, ConnectorError, RawRecord
from ingestion.connectors.pendiente import PendienteConnector
from ingestion.connectors.usgs import UsgsConnector

__all__ = ["Connector", "ConnectorError", "RawRecord", "PendienteConnector", "UsgsConnector"]
