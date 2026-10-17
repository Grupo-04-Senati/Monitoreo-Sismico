from app import __version__


def test_liveness_no_toca_la_base(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["version"] == __version__


def test_health_de_raiz_se_conserva(client):
    assert client.get("/health").json() == {"status": "ok", "version": __version__}


def test_correlation_id_se_genera_y_se_respeta(client):
    generado = client.get("/api/v1/health").headers["X-Request-ID"]
    assert len(generado) >= 16
    r = client.get("/api/v1/health", headers={"X-Request-ID": "abc-123"})
    assert r.headers["X-Request-ID"] == "abc-123"


def test_cabeceras_de_seguridad(client):
    h = client.get("/api/v1/health").headers
    assert h["X-Content-Type-Options"] == "nosniff"
    assert h["X-Frame-Options"] == "DENY"


def test_error_404_con_formato_unico(client):
    r = client.get("/api/v1/no-existe")
    assert r.status_code == 404
    body = r.json()
    assert body["error"]["code"] == "NOT_FOUND"
    assert set(body["error"]) == {"code", "message", "details"}


def test_readiness_con_base_de_datos(client, require_db):
    r = client.get("/api/v1/health/ready")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["database"]["ok"] is True
    assert body["database"]["latency_ms"] is not None
