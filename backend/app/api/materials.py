from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Material
from app.schemas.material import MaterialCreate, MaterialOut

router = APIRouter()


@router.get("", response_model=list[MaterialOut])
def list_materials(db: Session = Depends(get_db)) -> list[MaterialOut]:
    materials = db.query(Material).order_by(Material.name.asc(), Material.id.asc()).all()
    return [MaterialOut.model_validate(material) for material in materials]


@router.post("", response_model=MaterialOut, status_code=status.HTTP_201_CREATED)
def create_material(
    payload: MaterialCreate, db: Session = Depends(get_db)
) -> MaterialOut:
    existing = (
        db.query(Material)
        .filter(Material.name == payload.name, Material.color == payload.color)
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Material with the same name and color already exists.",
        )

    material = Material(name=payload.name, color=payload.color)
    db.add(material)
    db.commit()
    db.refresh(material)
    return MaterialOut.model_validate(material)
