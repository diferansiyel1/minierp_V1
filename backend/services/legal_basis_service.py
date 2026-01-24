import json
from typing import Dict, Any

from sqlalchemy.orm import Session

from .. import models


DEFAULT_TECHNOPARK_LEGAL_BASIS: Dict[str, Any] = {
    "corporate_tax_exemption": {
        "label": "Kurumlar Vergisi İstisnası",
        "law": "4691 S.K. Geçici 2 ve 5746 S.K.",
        "note": "İstisna matrahı = Muaf gelir - Ar-Ge giderleri",
    },
    "vat_exemption": {
        "label": "KDV İstisnası",
        "law": "3065 KDVK Geçici 20 (Kod 351)",
        "note": "Bölge içi yazılım/Ar-Ge teslimleri KDV'den istisnadır",
    },
    "income_tax_exemption": {
        "label": "Gelir Vergisi İstisnası",
        "law": "4691 S.K. Geçici 2 ve 5746 S.K.",
        "note": "Eğitim durumuna göre %80-%95 oran",
    },
    "sgk_employer_support": {
        "label": "SGK İşveren Hissesi Desteği",
        "law": "5746 S.K. 3",
        "note": "İşveren hissesi desteği %50",
    },
    "stamp_tax_exemption": {
        "label": "Damga Vergisi İstisnası",
        "law": "4691 S.K. Geçici 2",
        "note": "Damga vergisi istisnası %100",
    },
    "venture_capital_obligation": {
        "label": "Girişim Sermayesi Yükümlülüğü",
        "law": "5746 S.K. 3",
        "note": "İstisna matrahı 5.000.000 TL üzeri için %3",
    },
}


class LegalBasisService:
    def __init__(self, db: Session):
        self.db = db

    def get_technopark_legal_basis(self) -> Dict[str, Any]:
        setting = self.db.query(models.SystemSetting).filter(
            models.SystemSetting.key == "technopark_legal_basis"
        ).first()

        if setting and setting.value:
            try:
                return json.loads(setting.value)
            except Exception:
                pass

        return DEFAULT_TECHNOPARK_LEGAL_BASIS

    def update_technopark_legal_basis(self, updates: Dict[str, Any]) -> Dict[str, Any]:
        current = self.get_technopark_legal_basis()
        current.update(updates)

        setting = self.db.query(models.SystemSetting).filter(
            models.SystemSetting.key == "technopark_legal_basis"
        ).first()
        if setting:
            setting.value = json.dumps(current)
        else:
            setting = models.SystemSetting(
                key="technopark_legal_basis",
                value=json.dumps(current),
                description="Teknokent yasal dayanak sözlüğü",
            )
            self.db.add(setting)
        self.db.commit()
        return current

