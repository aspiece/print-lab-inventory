from app.models import Material


def test_spool_api_returns_google_sheet_fields(client, db_session):
    material = Material(name="PLA", color="Blue")
    db_session.add(material)
    db_session.commit()

    create_response = client.post(
        "/spools",
        json={
            "material_id": material.id,
            "brand": "Overture",
            "original_filament_weight": 1000,
            "empty_spool_weight": 100,
            "low_stock_threshold": 200,
            "storage_location": "Cabinet A",
            "date_opened": "2026-09-01",
            "notes": "Classroom stock",
            "user_id": "teacher",
        },
    )

    assert create_response.status_code == 201
    created_payload = create_response.json()
    assert created_payload["brand"] == "Overture"
    assert created_payload["status"] == "In storage"
    assert created_payload["storage_location"] == "Cabinet A"
    assert created_payload["loaded_printer"] is None
    assert created_payload["date_opened"] == "2026-09-01"
    assert created_payload["notes"] == "Classroom stock"

    machine_response = client.post("/machines", json={"name": "Printer 1", "status": "online"})
    machine_id = machine_response.json()["id"]

    assign_response = client.post(
        f"/spools/{created_payload['id']}/assign",
        json={"machine_id": machine_id, "user_id": "teacher"},
    )

    assert assign_response.status_code == 200
    assigned_payload = assign_response.json()
    assert assigned_payload["status"] == "Loaded"
    assert assigned_payload["loaded_printer"] == "Printer 1"
