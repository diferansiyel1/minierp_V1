"""
Teknokent Vergi Muafiyeti Hesaplama Servisi
5746/4691 Sayılı Kanun Kapsamında Vergi İstisnaları

Bu modül şunları hesaplar:
- Kurumlar Vergisi İstisnası
- KDV Muafiyeti
- Personel Gelir Vergisi İstisnası
- SGK İşveren Hissesi Desteği
- Damga Vergisi İstisnası
- Girişim Sermayesi Yükümlülüğü
"""

from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import extract
import json

from .. import models, schemas


class TaxService:
    """Teknokent Vergi Muafiyeti Hesaplama Servisi"""
    
    def __init__(self, db: Session):
        self.db = db
        self._tax_params: Optional[Dict[str, Any]] = None
    
    def get_tax_parameters(self, year: int = 2026) -> Dict[str, Any]:
        """Vergi parametrelerini SystemSettings'den al"""
        if self._tax_params is not None:
            return self._tax_params
        
        setting = self.db.query(models.SystemSetting).filter(
            models.SystemSetting.key == f"tax_parameters_{year}"
        ).first()
        
        if setting and setting.value:
            self._tax_params = json.loads(setting.value)
            return self._tax_params
        
        # Varsayılan değerler
        return {
            "year": year,
            "venture_capital_limit": 5000000.0,
            "venture_capital_rate": 0.03,
            "venture_capital_max_amount": 100000000.0,
            "remote_work_rate_informatics": 1.0,
            "remote_work_rate_other": 0.75,
            "income_tax_exemptions": {
                "phd_basic_sciences": 0.95,
                "masters_basic_sciences": 0.90,
                "phd_other": 0.90,
                "masters_other": 0.80,
                "bachelors": 0.80
            },
            "corporate_tax_rate": 0.25,
            "vat_rate": 0.20,
            "daily_food_exemption": 300.0,
            "daily_transport_exemption": 158.0,
            "sgk_employer_share_discount": 0.50,
            "stamp_tax_exemption_rate": 1.0
        }
    
    def calculate_corporate_tax_exemption(
        self, 
        tenant_id: Optional[int], 
        year: int, 
        month: int
    ) -> schemas.CorporateTaxExemptionResult:
        """
        Kurumlar Vergisi İstisnası Hesapla
        
        Formül: (Muaf Gelir) - (Ar-Ge Giderleri) = İstisna Matrahı
        Kurumlar Vergisi İstisnası = İstisna Matrahı * %25
        
        Args:
            tenant_id: Kiracı ID (None ise tüm kiracılar)
            year: Yıl
            month: Ay
            
        Returns:
            CorporateTaxExemptionResult: Hesaplama sonucu
        """
        params = self.get_tax_parameters(year)
        
        # Muaf Gelir - KDV istisna kodu 351 / is_exempt / ürün istisna kodu olan satırlar
        sales_query = self.db.query(models.Invoice).filter(
            models.Invoice.invoice_type == models.InvoiceType.SALES,
            extract('year', models.Invoice.issue_date) == year,
            extract('month', models.Invoice.issue_date) == month
        )
        
        if tenant_id:
            sales_query = sales_query.filter(models.Invoice.tenant_id == tenant_id)
        
        sales_invoices = sales_query.all()
        
        total_exempt_income = 0.0
        for invoice in sales_invoices:
            # Eğer fatura bazında istisna matrahı hesaplanmışsa öncelik ver
            if invoice.exempt_amount and invoice.exempt_amount > 0:
                total_exempt_income += invoice.exempt_amount
                continue

            invoice_is_technopark = bool(
                invoice.project and invoice.project.is_technopark_project
            )

            # Her faturadaki muaf kalemlerin toplamını al
            for item in invoice.items:
                product = item.product
                exemption_code = (item.exemption_code or "").strip()
                legacy_reason = (item.vat_exemption_reason or "").strip()
                product_code = (product.vat_exemption_reason_code or "").strip() if product else ""
                vat_zero = (item.vat_rate == 0) or (item.vat_amount == 0)

                is_exempt_line = (
                    item.is_exempt
                    or exemption_code in {"351", "3065 G.20/1"}
                    or "351" in legacy_reason
                    or product_code == "351"
                    or (product and product.is_software_product)
                    or (invoice_is_technopark and vat_zero)
                )

                if is_exempt_line:
                    total_exempt_income += item.line_total
        
        # Ar-Ge Giderleri - expense_center = RD_CENTER olan giderler
        expense_query = self.db.query(models.Invoice).filter(
            models.Invoice.invoice_type == models.InvoiceType.PURCHASE,
            models.Invoice.expense_center == models.ExpenseCenter.RD_CENTER.value,
            extract('year', models.Invoice.issue_date) == year,
            extract('month', models.Invoice.issue_date) == month
        )
        
        if tenant_id:
            expense_query = expense_query.filter(models.Invoice.tenant_id == tenant_id)
        
        expense_invoices = expense_query.all()
        total_rd_expense = sum(inv.total_amount for inv in expense_invoices)
        
        # İstisna Matrahı
        exemption_base = max(0.0, total_exempt_income - total_rd_expense)
        
        # Kurumlar Vergisi İstisnası (%25)
        corporate_tax_rate = params.get("corporate_tax_rate", 0.25)
        corporate_tax_exemption = exemption_base * corporate_tax_rate
        
        # KDV İstisnası (%20)
        vat_rate = params.get("vat_rate", 0.20)
        vat_exemption = total_exempt_income * vat_rate
        
        # Girişim Sermayesi Yükümlülüğü
        venture_capital_obligation = self.check_venture_capital_obligation(exemption_base, params)
        
        return schemas.CorporateTaxExemptionResult(
            total_exempt_income=total_exempt_income,
            total_rd_expense=total_rd_expense,
            exemption_base=exemption_base,
            corporate_tax_exemption=corporate_tax_exemption,
            vat_exemption=vat_exemption,
            venture_capital_obligation=venture_capital_obligation,
            is_venture_capital_required=venture_capital_obligation > 0
        )
    
    def check_venture_capital_obligation(
        self, 
        exemption_base: float,
        params: Optional[Dict[str, Any]] = None
    ) -> float:
        """
        Girişim Sermayesi Yükümlülüğü Kontrolü
        
        5746/4691 Sayılı Kanun gereği:
        - İstisna matrahı 5.000.000 TL'yi aşarsa
        - Aşan kısmın %3'ü kadar Girişim Sermayesi Fonu'na yatırım zorunludur
        - Üst sınır: 100.000.000 TL
        
        Args:
            exemption_base: İstisna matrahı
            params: Vergi parametreleri (opsiyonel)
            
        Returns:
            float: Girişim sermayesi yükümlülüğü tutarı (TL)
        """
        if params is None:
            params = self.get_tax_parameters()
        
        limit = params.get("venture_capital_limit", 5000000.0)
        rate = params.get("venture_capital_rate", 0.03)
        max_amount = params.get("venture_capital_max_amount", 100000000.0)
        
        if exemption_base <= limit:
            return 0.0
        
        # Sınırı aşan kısım
        excess_amount = min(exemption_base - limit, max_amount - limit)
        
        # %3 yükümlülük
        obligation = excess_amount * rate
        
        return obligation
    
    def calculate_personnel_incentives(
        self,
        tenant_id: Optional[int],
        year: int,
        month: int,
        personnel_work_data: Optional[List[Dict[str, Any]]] = None
    ) -> Tuple[List[schemas.PersonnelIncentiveResult], float]:
        """
        Personel Teşvik Hesaplaması
        
        5746/4691 Sayılı Kanun gereği Teknokent personeli için:
        - Gelir Vergisi İstisnası (eğitim durumuna göre %80-%95)
        - SGK İşveren Hissesi Desteği (%50)
        - Damga Vergisi İstisnası (%100)
        - Uzaktan Çalışma Oranı (Bilişim %100, Diğer %75)
        
        Args:
            tenant_id: Kiracı ID
            year: Yıl
            month: Ay
            personnel_work_data: Personel çalışma verisi listesi
                [{"user_id": 1, "days_worked": 22, "remote_days": 15}, ...]
                
        Returns:
            Tuple[List[PersonnelIncentiveResult], float]: Personel teşvik sonuçları ve toplam
        """
        params = self.get_tax_parameters(year)
        results: List[schemas.PersonnelIncentiveResult] = []
        total_incentive = 0.0
        
        # Tenant'a ait kullanıcıları al
        users_query = self.db.query(models.User).filter(
            models.User.is_active == True
        )
        
        if tenant_id:
            users_query = users_query.filter(models.User.tenant_id == tenant_id)
        
        users = users_query.all()
        
        # Çalışma verisi dictionary'e çevir
        work_data_map = {}
        if personnel_work_data:
            for data in personnel_work_data:
                work_data_map[data["user_id"]] = data
        
        for user in users:
            # Varsayılan çalışma günü (ay için 22 gün)
            work_data = work_data_map.get(user.id, {
                "days_worked": 22,
                "remote_days": 0
            })
            
            days_worked = work_data.get("days_worked", 22)
            remote_days = work_data.get("remote_days", 0)
            
            # Günlük brüt maaş kontrolü
            daily_salary = user.daily_gross_salary or 0.0
            if daily_salary <= 0:
                continue  # Maaş tanımlanmamış personel atlansın
            
            # Uzaktan Çalışma Oranı
            remote_work_rate = self._get_remote_work_rate(user, params)
            
            # Gelir Vergisi İstisna Oranı
            income_tax_exemption_rate = self._get_income_tax_exemption_rate(user, params)
            
            # Teşvik Hesaplamaları
            monthly_gross = daily_salary * days_worked
            
            # Gelir Vergisi İstisnası (uzaktan çalışma oranı uygulanır)
            effective_remote_ratio = (remote_days / days_worked) if days_worked > 0 else 0
            # Teknokent'te çalışılan günler için %100, uzaktan için belirlenen oran
            office_days = days_worked - remote_days
            
            # Ofiste çalışılan günler için tam istisna
            office_exemption = (office_days / days_worked) * monthly_gross * income_tax_exemption_rate * 0.15  # ~%15 gelir vergisi
            
            # Uzaktan çalışılan günler için oransal istisna
            remote_exemption = (remote_days / days_worked) * monthly_gross * income_tax_exemption_rate * remote_work_rate * 0.15
            
            calculated_income_tax_exemption = office_exemption + remote_exemption
            
            # SGK İşveren Hissesi Desteği (%50)
            sgk_rate = params.get("sgk_employer_share_discount", 0.50)
            # İşveren SGK payı genellikle brüt maaşın %22.5'i
            sgk_employer_discount = monthly_gross * 0.225 * sgk_rate
            
            # Damga Vergisi İstisnası
            stamp_tax_rate = params.get("stamp_tax_exemption_rate", 1.0)
            # Damga vergisi %0.759
            stamp_tax_exemption = monthly_gross * 0.00759 * stamp_tax_rate
            
            # Toplam Teşvik
            person_total = calculated_income_tax_exemption + sgk_employer_discount + stamp_tax_exemption
            total_incentive += person_total
            
            results.append(schemas.PersonnelIncentiveResult(
                user_id=user.id,
                full_name=user.full_name,
                education_level=user.education_level or "Lisans",
                is_basic_science_grad=user.is_basic_science_grad or False,
                is_informatics_personnel=user.is_informatics_personnel or False,
                days_worked=days_worked,
                remote_days=remote_days,
                remote_work_ratio=remote_work_rate,
                income_tax_exemption_rate=income_tax_exemption_rate,
                calculated_income_tax_exemption=calculated_income_tax_exemption,
                sgk_employer_discount=sgk_employer_discount,
                stamp_tax_exemption=stamp_tax_exemption,
                total_incentive=person_total
            ))
        
        return results, total_incentive
    
    def _get_remote_work_rate(self, user: models.User, params: Dict[str, Any]) -> float:
        """Uzaktan çalışma oranını belirle"""
        if user.is_informatics_personnel:
            return params.get("remote_work_rate_informatics", 1.0)
        return params.get("remote_work_rate_other", 0.75)
    
    def _get_income_tax_exemption_rate(self, user: models.User, params: Dict[str, Any]) -> float:
        """Gelir vergisi istisna oranını belirle"""
        exemptions = params.get("income_tax_exemptions", {})
        education_level = user.education_level or "Lisans"
        is_basic_science = user.is_basic_science_grad or False
        
        if education_level == "Doktora":
            if is_basic_science:
                return exemptions.get("phd_basic_sciences", 0.95)
            return exemptions.get("phd_other", 0.90)
        elif education_level == "Yüksek Lisans":
            if is_basic_science:
                return exemptions.get("masters_basic_sciences", 0.90)
            return exemptions.get("masters_other", 0.80)
        else:  # Lisans veya Diğer
            return exemptions.get("bachelors", 0.80)
    
    def calculate_monthly_tax_summary(
        self,
        tenant_id: Optional[int],
        year: int,
        month: int,
        personnel_work_data: Optional[List[Dict[str, Any]]] = None
    ) -> schemas.MonthlyTaxCalculationResult:
        """
        Aylık Vergi Özeti Hesapla
        
        Args:
            tenant_id: Kiracı ID
            year: Yıl
            month: Ay
            personnel_work_data: Personel çalışma verisi
            
        Returns:
            MonthlyTaxCalculationResult: Aylık vergi hesaplama sonucu
        """
        # Kurumlar Vergisi Hesapla
        corporate_tax = self.calculate_corporate_tax_exemption(tenant_id, year, month)
        
        # Personel Teşviklerini Hesapla
        personnel_incentives, total_personnel_incentive = self.calculate_personnel_incentives(
            tenant_id, year, month, personnel_work_data
        )
        
        # Toplam Vergi Avantajı
        total_tax_advantage = (
            corporate_tax.corporate_tax_exemption +
            corporate_tax.vat_exemption +
            total_personnel_incentive
        )
        
        # Girişim Sermayesi Uyarısı
        venture_capital_warning = None
        if corporate_tax.is_venture_capital_required:
            venture_capital_warning = (
                f"DİKKAT: 5746/4691 Sayılı kanun gereği "
                f"{corporate_tax.venture_capital_obligation:,.2f} TL tutarında "
                f"Girişim Sermayesi Yatırımı yapılması zorunludur."
            )
        
        return schemas.MonthlyTaxCalculationResult(
            year=year,
            month=month,
            corporate_tax=corporate_tax,
            personnel_incentives=personnel_incentives,
            total_personnel_incentive=total_personnel_incentive,
            total_tax_advantage=total_tax_advantage,
            venture_capital_warning=venture_capital_warning
        )
    
    def calculate_yearly_summary(
        self,
        tenant_id: Optional[int],
        year: int
    ) -> schemas.YearlyTaxSummary:
        """
        Yıllık Vergi Özeti Hesapla
        
        Args:
            tenant_id: Kiracı ID
            year: Yıl
            
        Returns:
            YearlyTaxSummary: Yıllık vergi özeti
        """
        total_exempt_income = 0.0
        total_rd_expense = 0.0
        total_corporate_tax_exemption = 0.0
        total_vat_exemption = 0.0
        total_personnel_incentive = 0.0
        total_venture_capital_obligation = 0.0
        
        for month in range(1, 13):
            result = self.calculate_monthly_tax_summary(tenant_id, year, month)
            
            total_exempt_income += result.corporate_tax.total_exempt_income
            total_rd_expense += result.corporate_tax.total_rd_expense
            total_corporate_tax_exemption += result.corporate_tax.corporate_tax_exemption
            total_vat_exemption += result.corporate_tax.vat_exemption
            total_personnel_incentive += result.total_personnel_incentive
            total_venture_capital_obligation += result.corporate_tax.venture_capital_obligation
        
        total_tax_advantage = (
            total_corporate_tax_exemption +
            total_vat_exemption +
            total_personnel_incentive
        )
        
        return schemas.YearlyTaxSummary(
            year=year,
            total_exempt_income=total_exempt_income,
            total_rd_expense=total_rd_expense,
            total_corporate_tax_exemption=total_corporate_tax_exemption,
            total_vat_exemption=total_vat_exemption,
            total_personnel_incentive=total_personnel_incentive,
            total_venture_capital_obligation=total_venture_capital_obligation,
            total_tax_advantage=total_tax_advantage
        )
    
    def update_tax_parameters(
        self,
        year: int,
        updates: schemas.TaxParametersUpdate
    ) -> schemas.TaxParameters2026:
        """
        Vergi Parametrelerini Güncelle
        
        Args:
            year: Yıl
            updates: Güncellenecek parametreler
            
        Returns:
            TaxParameters2026: Güncellenmiş parametreler
        """
        key = f"tax_parameters_{year}"
        
        # Mevcut parametreleri al
        current_params = self.get_tax_parameters(year)
        
        # Güncellemeleri uygula
        update_dict = updates.model_dump(exclude_unset=True)
        
        for field, value in update_dict.items():
            if value is not None:
                if field == "income_tax_exemptions" and isinstance(value, dict):
                    current_params["income_tax_exemptions"].update(value)
                else:
                    current_params[field] = value
        
        # Veritabanına kaydet
        setting = self.db.query(models.SystemSetting).filter(
            models.SystemSetting.key == key
        ).first()
        
        if setting:
            setting.value = json.dumps(current_params)
        else:
            setting = models.SystemSetting(
                key=key,
                value=json.dumps(current_params),
                description=f"{year} Yılı Teknokent Vergi Parametreleri"
            )
            self.db.add(setting)
        
        self.db.commit()
        
        # Cache'i temizle
        self._tax_params = None
        
        # Pydantic modeline dönüştür
        return schemas.TaxParameters2026(**current_params)


def get_tax_service(db: Session) -> TaxService:
    """TaxService dependency injection helper"""
    return TaxService(db)
