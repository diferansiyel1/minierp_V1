"""
Teknokent Muafiyet Raporu PDF Oluşturma Servisi
YMM (Yeminli Mali Müşavir) Formatında Raporlama

Bu modül şunları içerir:
- Aylık Muafiyet Raporu PDF
- Proje Özeti
- Gelir Analizi
- Personel Analizi
- Kurumlar Vergisi Hesaplaması
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, date
from io import BytesIO
import os

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from sqlalchemy.orm import Session
from sqlalchemy import extract

from .. import models, schemas
from .tax_service import TaxService


class ReportingService:
    """Teknokent Muafiyet Raporu PDF Oluşturma Servisi"""
    
    def __init__(self, db: Session):
        self.db = db
        self.tax_service = TaxService(db)
        self._register_fonts()
    
    def _register_fonts(self):
        """Türkçe karakter desteği için font kayıt"""
        font_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'fonts')
        try:
            if os.path.exists(os.path.join(font_dir, 'DejaVuSans.ttf')):
                pdfmetrics.registerFont(TTFont('DejaVuSans', os.path.join(font_dir, 'DejaVuSans.ttf')))
                pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', os.path.join(font_dir, 'DejaVuSans-Bold.ttf')))
        except Exception:
            pass  # Fallback to default fonts
    
    def _get_styles(self) -> Dict[str, ParagraphStyle]:
        """PDF stilleri oluştur"""
        styles = getSampleStyleSheet()
        
        # Türkçe karakter desteği için font belirleme
        font_name = 'DejaVuSans' if 'DejaVuSans' in pdfmetrics.getRegisteredFontNames() else 'Helvetica'
        font_bold = 'DejaVuSans-Bold' if 'DejaVuSans-Bold' in pdfmetrics.getRegisteredFontNames() else 'Helvetica-Bold'
        self._font_name = font_name
        self._font_bold = font_bold
        
        custom_styles = {
            'Title': ParagraphStyle(
                'CustomTitle',
                parent=styles['Title'],
                fontName=font_bold,
                fontSize=18,
                spaceAfter=20,
                alignment=1  # Center
            ),
            'Heading1': ParagraphStyle(
                'CustomHeading1',
                parent=styles['Heading1'],
                fontName=font_bold,
                fontSize=14,
                spaceBefore=15,
                spaceAfter=10,
                textColor=colors.HexColor('#1a365d')
            ),
            'Heading2': ParagraphStyle(
                'CustomHeading2',
                parent=styles['Heading2'],
                fontName=font_bold,
                fontSize=12,
                spaceBefore=10,
                spaceAfter=8,
                textColor=colors.HexColor('#2c5282')
            ),
            'Normal': ParagraphStyle(
                'CustomNormal',
                parent=styles['Normal'],
                fontName=font_name,
                fontSize=10,
                spaceAfter=6
            ),
            'Warning': ParagraphStyle(
                'Warning',
                parent=styles['Normal'],
                fontName=font_bold,
                fontSize=11,
                textColor=colors.red,
                backColor=colors.HexColor('#fed7d7'),
                borderPadding=10,
                spaceBefore=10,
                spaceAfter=10
            ),
            'TableHeader': ParagraphStyle(
                'TableHeader',
                parent=styles['Normal'],
                fontName=font_bold,
                fontSize=9,
                textColor=colors.white
            ),
            'TableCell': ParagraphStyle(
                'TableCell',
                parent=styles['Normal'],
                fontName=font_name,
                fontSize=9
            )
        }
        
        return custom_styles

    def _apply_table_style(self, table: Table, header_rows: int = 1) -> None:
        """Tablolara Türkçe fontlarını uygula."""
        font_name = getattr(self, "_font_name", "Helvetica")
        font_bold = getattr(self, "_font_bold", "Helvetica-Bold")

        base_style = [
            ('FONTNAME', (0, 0), (-1, -1), font_name),
            ('FONTNAME', (0, 0), (-1, header_rows - 1), font_bold),
        ]
        table.setStyle(TableStyle(base_style))
    
    def generate_monthly_exemption_report(
        self,
        tenant_id: Optional[int],
        year: int,
        month: int,
        company_info: Optional[Dict[str, Any]] = None
    ) -> BytesIO:
        """
        Aylık Teknokent Muafiyet Raporu PDF Oluştur
        
        Args:
            tenant_id: Kiracı ID
            year: Yıl
            month: Ay
            company_info: Firma bilgileri
            
        Returns:
            BytesIO: PDF dosyası
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2*cm,
            leftMargin=2*cm,
            topMargin=2*cm,
            bottomMargin=2*cm
        )
        
        styles = self._get_styles()
        story = []
        
        # Vergi hesaplamalarını al
        tax_result = self.tax_service.calculate_monthly_tax_summary(tenant_id, year, month)
        
        # Firma bilgilerini al
        if company_info is None:
            company_info = self._get_company_info(tenant_id)
        
        # Ay adı
        month_names = [
            "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
            "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
        ]
        month_name = month_names[month] if 1 <= month <= 12 else str(month)
        
        # ==================== HEADER ====================
        story.append(Paragraph(
            f"TEKNOKENT MUAFİYET RAPORU",
            styles['Title']
        ))
        story.append(Paragraph(
            f"{month_name} {year}",
            styles['Heading2']
        ))
        story.append(Spacer(1, 0.5*cm))
        
        # Firma Bilgileri
        story.append(Paragraph("FİRMA BİLGİLERİ", styles['Heading1']))
        company_data = [
            ["Firma Unvanı:", company_info.get('company_name', '-')],
            ["Vergi No:", company_info.get('tax_id', '-')],
            ["Vergi Dairesi:", company_info.get('tax_office', '-')],
            ["Adres:", company_info.get('address', '-')],
        ]
        company_table = Table(company_data, colWidths=[4*cm, 12*cm])
        company_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), self._font_bold),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        self._apply_table_style(company_table, header_rows=0)
        story.append(company_table)
        story.append(Spacer(1, 0.5*cm))
        
        # ==================== SECTION A: PROJE ÖZETİ ====================
        story.append(Paragraph("A. PROJE ÖZETİ", styles['Heading1']))
        
        projects = self._get_active_projects(tenant_id)
        if projects:
            project_data = [["Proje Kodu", "Proje Adı", "Durum", "Muafiyet Kodu"]]
            for project in projects:
                project_data.append([
                    project.code,
                    project.name[:40] + "..." if len(project.name) > 40 else project.name,
                    project.status,
                    project.exemption_code
                ])
            
            project_table = Table(project_data, colWidths=[3*cm, 8*cm, 3*cm, 3*cm])
            project_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
            ]))
            self._apply_table_style(project_table)
            story.append(project_table)
        else:
            story.append(Paragraph("Aktif proje bulunmamaktadır.", styles['Normal']))
        
        story.append(Spacer(1, 0.5*cm))
        
        # ==================== SECTION B: GELİR ANALİZİ ====================
        story.append(Paragraph("B. GELİR ANALİZİ (KDV Muafiyeti Kod 351)", styles['Heading1']))
        
        income_data = [
            ["Kalem", "Tutar (TL)"],
            ["Toplam Muaf Gelir (Yazılım Satışları)", f"{tax_result.corporate_tax.total_exempt_income:,.2f}"],
            ["KDV Muafiyeti (%20)", f"{tax_result.corporate_tax.vat_exemption:,.2f}"],
        ]
        
        income_table = Table(income_data, colWidths=[10*cm, 6*cm])
        income_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        self._apply_table_style(income_table)
        story.append(income_table)
        story.append(Spacer(1, 0.5*cm))
        
        # ==================== SECTION C: PERSONEL ANALİZİ ====================
        story.append(Paragraph("C. PERSONEL ANALİZİ", styles['Heading1']))
        
        if tax_result.personnel_incentives:
            personnel_data = [["Personel", "Eğitim", "Gün", "Uzaktan", "GV İstisnası", "SGK Destek", "Toplam"]]
            for p in tax_result.personnel_incentives:
                personnel_data.append([
                    p.full_name[:20] + "..." if len(p.full_name) > 20 else p.full_name,
                    p.education_level[:10],
                    str(p.days_worked),
                    str(p.remote_days),
                    f"{p.calculated_income_tax_exemption:,.0f}",
                    f"{p.sgk_employer_discount:,.0f}",
                    f"{p.total_incentive:,.0f}"
                ])
            
            # Toplam satırı
            personnel_data.append([
                "TOPLAM", "", "", "",
                f"{sum(p.calculated_income_tax_exemption for p in tax_result.personnel_incentives):,.0f}",
                f"{sum(p.sgk_employer_discount for p in tax_result.personnel_incentives):,.0f}",
                f"{tax_result.total_personnel_incentive:,.0f}"
            ])
            
            personnel_table = Table(personnel_data, colWidths=[3.5*cm, 2*cm, 1.2*cm, 1.5*cm, 2.5*cm, 2.5*cm, 2.5*cm])
            personnel_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e2e8f0')),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
            ]))
            self._apply_table_style(personnel_table)
            story.append(personnel_table)
        else:
            story.append(Paragraph("Personel verisi bulunmamaktadır.", styles['Normal']))
        
        story.append(Spacer(1, 0.5*cm))
        
        # ==================== SECTION D: KURUMLAR VERGİSİ HESAPLAMASI ====================
        story.append(Paragraph("D. KURUMLAR VERGİSİ İSTİSNASI HESAPLAMASI", styles['Heading1']))
        
        corp_data = [
            ["Kalem", "Tutar (TL)"],
            ["Muaf Gelir (A)", f"{tax_result.corporate_tax.total_exempt_income:,.2f}"],
            ["Ar-Ge Giderleri (B)", f"{tax_result.corporate_tax.total_rd_expense:,.2f}"],
            ["İstisna Matrahı (A-B)", f"{tax_result.corporate_tax.exemption_base:,.2f}"],
            ["Kurumlar Vergisi İstisnası (%25)", f"{tax_result.corporate_tax.corporate_tax_exemption:,.2f}"],
        ]
        
        corp_table = Table(corp_data, colWidths=[10*cm, 6*cm])
        corp_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#c6f6d5')),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        self._apply_table_style(corp_table)
        story.append(corp_table)
        story.append(Spacer(1, 0.5*cm))
        
        # ==================== WARNING BOX ====================
        if tax_result.venture_capital_warning:
            story.append(Spacer(1, 0.3*cm))
            warning_table = Table(
                [[Paragraph(tax_result.venture_capital_warning, styles['Warning'])]],
                colWidths=[16*cm]
            )
            warning_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fed7d7')),
                ('BOX', (0, 0), (-1, -1), 2, colors.red),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ]))
            story.append(warning_table)
            story.append(Spacer(1, 0.5*cm))
        
        # ==================== TOPLAM VERGİ AVANTAJI ====================
        story.append(Paragraph("TOPLAM VERGİ AVANTAJI", styles['Heading1']))
        
        summary_data = [
            ["Kalem", "Tutar (TL)"],
            ["Kurumlar Vergisi İstisnası", f"{tax_result.corporate_tax.corporate_tax_exemption:,.2f}"],
            ["KDV Muafiyeti", f"{tax_result.corporate_tax.vat_exemption:,.2f}"],
            ["Personel Teşvikleri", f"{tax_result.total_personnel_incentive:,.2f}"],
            ["TOPLAM VERGİ AVANTAJI", f"{tax_result.total_tax_advantage:,.2f}"],
        ]
        
        summary_table = Table(summary_data, colWidths=[10*cm, 6*cm])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a365d')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#38a169')),
            ('TEXTCOLOR', (0, -1), (-1, -1), colors.white),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('FONTSIZE', (0, -1), (-1, -1), 12),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
        ]))
        self._apply_table_style(summary_table)
        story.append(summary_table)
        
        # ==================== FOOTER ====================
        story.append(Spacer(1, 1*cm))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.grey))
        story.append(Spacer(1, 0.3*cm))
        footer_style = ParagraphStyle(
            'Footer',
            fontName=self._font_name,
            fontSize=8,
            textColor=colors.grey,
            alignment=1
        )
        story.append(Paragraph(
            f"Bu rapor {datetime.now().strftime('%d.%m.%Y %H:%M')} tarihinde MiniERP sistemi tarafından oluşturulmuştur.",
            footer_style
        ))
        story.append(Paragraph(
            "5746/4691 Sayılı Kanun kapsamında Teknokent vergi istisnaları için YMM onayı gereklidir.",
            footer_style
        ))
        
        # PDF oluştur
        doc.build(story)
        buffer.seek(0)
        
        return buffer
    
    def _get_company_info(self, tenant_id: Optional[int]) -> Dict[str, Any]:
        """Firma bilgilerini al"""
        if tenant_id:
            tenant = self.db.query(models.Tenant).filter(
                models.Tenant.id == tenant_id
            ).first()
            
            if tenant and tenant.settings:
                try:
                    import json
                    return json.loads(tenant.settings)
                except Exception:
                    pass
        
        return {
            "company_name": "Firma Adı Belirtilmemiş",
            "tax_id": "-",
            "tax_office": "-",
            "address": "-"
        }
    
    def _get_active_projects(self, tenant_id: Optional[int]) -> List[models.Project]:
        """Aktif projeleri al (Teknokent bayrağından bağımsız)."""
        query = self.db.query(models.Project).filter(
            models.Project.status == models.ProjectStatus.ACTIVE.value
        )
        
        if tenant_id:
            query = query.filter(models.Project.tenant_id == tenant_id)
        
        return query.all()


    def generate_technopark_personnel_report(
        self,
        tenant_id: Optional[int],
        period_id: int,
    ) -> BytesIO:
        """Teknokent Personel Bildirim Listesi PDF oluştur."""
        period = self.db.query(models.PayrollPeriod).filter(
            models.PayrollPeriod.id == period_id
        ).first()

        if not period:
            raise ValueError("Bordro dönemi bulunamadı")

        if tenant_id and period.tenant_id != tenant_id:
            raise ValueError("Bu bordro dönemine erişim yetkiniz yok")

        entries = self.db.query(models.PayrollEntry).filter(
            models.PayrollEntry.payroll_period_id == period.id
        ).all()

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2*cm,
            leftMargin=2*cm,
            topMargin=2*cm,
            bottomMargin=2*cm
        )

        styles = self._get_styles()
        story = []

        story.append(Paragraph(
            "TEKNOKENT PERSONEL BİLDİRİM LİSTESİ",
            styles['Title']
        ))
        story.append(Paragraph(
            f"{period.month:02d}/{period.year}",
            styles['Heading2']
        ))
        story.append(Spacer(1, 0.4*cm))

        table_data = [[
            "Ad Soyad",
            "T.C.",
            "Unvan",
            "Ar-Ge Gün",
            "GV İstisnası",
            "DV İstisnası"
        ]]

        type_map = {
            models.PersonnelType.RD_PERSONNEL: "Ar-Ge Personeli",
            models.PersonnelType.SUPPORT_PERSONNEL: "Destek Personeli",
            models.PersonnelType.INTERN: "Stajyer",
            models.PersonnelType.SOFTWARE_PERSONNEL: "Yazılım Personeli",
        }

        for entry in entries:
            employee = entry.employee
            table_data.append([
                employee.full_name if employee else "-",
                employee.tc_id_no if employee else "-",
                type_map.get(employee.personnel_type, "-") if employee else "-",
                str(entry.worked_days),
                f"{entry.income_tax_exemption_amount:,.2f}",
                f"{entry.stamp_tax_exemption_amount:,.2f}",
            ])

        table = Table(table_data, colWidths=[4*cm, 3*cm, 3*cm, 2*cm, 2.5*cm, 2.5*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        self._apply_table_style(table)
        story.append(table)

        story.append(Spacer(1, 0.6*cm))
        footer_style = ParagraphStyle(
            'Footer',
            fontName=self._font_name,
            fontSize=8,
            textColor=colors.grey,
            alignment=1
        )
        story.append(Paragraph(
            "İşbu bordro 4691 ve 5746 sayılı kanun hükümlerine göre hesaplanmıştır.",
            footer_style
        ))

        doc.build(story)
        buffer.seek(0)
        return buffer

    def generate_official_technopark_report(
        self,
        report: models.TechnoparkReport,
        tax_result: schemas.MonthlyTaxCalculationResult,
        legal_basis: Dict[str, Any],
    ) -> BytesIO:
        """Resmi Teknokent muafiyet raporu PDF oluştur."""
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2 * cm,
            leftMargin=2 * cm,
            topMargin=2 * cm,
            bottomMargin=2 * cm,
        )

        styles = self._get_styles()
        story: List[Any] = []

        period_label = report.period_label or f"{report.month:02d} - {report.year}"

        story.append(Paragraph("TEKNOKENT MUAFİYET RAPORU", styles["Title"]))
        story.append(Paragraph(f"Dönem: {period_label}", styles["Heading2"]))
        story.append(Spacer(1, 0.4 * cm))

        company_table = Table(
            [
                ["Firma Unvanı", report.company_name or "-"],
                ["Vergi Dairesi - No", f"{report.tax_office or '-'} - {report.tax_id or '-'}"],
                ["SGK İşyeri No", report.sgk_workplace_no or "-"],
            ],
            colWidths=[5 * cm, 11 * cm],
        )
        company_table.setStyle(
            TableStyle(
                [
                    ("FONTNAME", (0, 0), (0, -1), self._font_bold),
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        self._apply_table_style(company_table, header_rows=0)
        story.append(company_table)
        story.append(Spacer(1, 0.4 * cm))

        # Devam eden projeler listesi
        story.append(Paragraph("DEVAM EDEN PROJELER LİSTESİ", styles["Heading1"]))
        if report.project_entries:
            project_data = [[
                "Sıra",
                "Proje Adı",
                "STB Proje Kodu",
                "Başlangıç",
                "Tahmini Bitiş",
                "Bitiş",
                "Ar-Ge",
                "Destek",
                "Kapsam Dışı",
                "Tasarım",
                "Toplam",
            ]]
            for index, entry in enumerate(report.project_entries, start=1):
                project_data.append([
                    str(index),
                    entry.project_name,
                    entry.stb_project_code or "-",
                    entry.start_date.strftime("%d.%m.%Y") if entry.start_date else "-",
                    entry.planned_end_date.strftime("%d.%m.%Y") if entry.planned_end_date else "-",
                    entry.end_date.strftime("%d.%m.%Y") if entry.end_date else "-",
                    str(entry.rd_personnel_count),
                    str(entry.support_personnel_count),
                    str(entry.non_scope_personnel_count),
                    str(entry.design_personnel_count),
                    str(entry.total_personnel_count),
                ])
            table = Table(project_data, colWidths=[1 * cm, 4 * cm, 2 * cm, 2 * cm, 2 * cm, 2 * cm, 1 * cm, 1 * cm, 1.2 * cm, 1 * cm, 1 * cm])
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2c5282")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            self._apply_table_style(table)
            story.append(table)
        else:
            story.append(Paragraph("Listelenecek kayıt bulunamadı.", styles["Normal"]))
        story.append(Spacer(1, 0.4 * cm))

        # Proje ilerleme
        story.append(Paragraph("PROJE İLERLEME", styles["Heading1"]))
        if report.project_progress_entries:
            for entry in report.project_progress_entries:
                progress_info = [
                    ["Proje Adı", entry.project_name],
                    ["STB Kodu", entry.stb_project_code or "-"],
                    ["Proje Başlangıç / Tahmini Bitiş", self._format_date_range(entry.start_date, entry.planned_end_date)],
                ]
                progress_table = Table(progress_info, colWidths=[5 * cm, 11 * cm])
                progress_table.setStyle(TableStyle([
                    ("FONTNAME", (0, 0), (0, -1), self._font_bold),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]))
                self._apply_table_style(progress_table, header_rows=0)
                story.append(progress_table)
                story.append(Paragraph(entry.progress_text or "-", styles["Normal"]))
                story.append(Spacer(1, 0.2 * cm))
        else:
            story.append(Paragraph("Listelenecek kayıt bulunamadı.", styles["Normal"]))
        story.append(Spacer(1, 0.4 * cm))

        # Personel bilgi formu
        story.append(Paragraph("TEKNOLOJİ GELİŞTİRME BÖLGESİ'NDE ÇALIŞAN PERSONEL BİLGİ FORMU", styles["Heading1"]))
        if report.personnel_entries:
            personnel_data = [[
                "Sıra",
                "TC Kimlik No",
                "Adı Soyadı",
                "Personel Tipi",
                "Bilişim",
                "TGB İçi Saat",
                "TGB İçi Saat/Dk",
                "TGB Dışı Saat",
                "TGB Dışı Saat/Dk",
                "Yıllık İzin",
                "Resmi Tatil",
                "CB Bölge Dışı",
                "Toplam Saat",
                "Toplam Saat/Dk",
            ]]
            for index, entry in enumerate(report.personnel_entries, start=1):
                personnel_data.append([
                    str(index),
                    entry.tc_id_no or "-",
                    entry.full_name,
                    entry.personnel_type or "-",
                    "Evet" if entry.is_it_personnel else "Hayır",
                    self._format_hours(entry.tgb_inside_minutes),
                    self._format_minutes(entry.tgb_inside_minutes),
                    self._format_hours(entry.tgb_outside_minutes),
                    self._format_minutes(entry.tgb_outside_minutes),
                    self._format_hours(entry.annual_leave_minutes),
                    self._format_hours(entry.official_holiday_minutes),
                    self._format_hours(entry.cb_outside_minutes),
                    self._format_hours(entry.total_minutes),
                    self._format_minutes(entry.total_minutes),
                ])
            table = Table(
                personnel_data,
                colWidths=[0.8 * cm, 2.2 * cm, 2.6 * cm, 1.8 * cm, 1 * cm, 1.2 * cm, 1.4 * cm, 1.2 * cm, 1.4 * cm, 1.2 * cm, 1.2 * cm, 1.4 * cm, 1.2 * cm, 1.4 * cm],
            )
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2c5282")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            self._apply_table_style(table)
            story.append(table)
        else:
            story.append(Paragraph("Listelenecek kayıt bulunamadı.", styles["Normal"]))
        story.append(Spacer(1, 0.4 * cm))

        # Line item sections
        self._append_line_items(
            story,
            styles,
            report,
            "Firma Ar-Ge Dışı Satış Geliri Bilgileri",
            schemas.TechnoparkLineCategory.NON_RD_INCOME,
        )
        self._append_line_items(
            story,
            styles,
            report,
            "Firma Ar-Ge Dışı Satış Geliri Bilgileri - Veri Takip Listesi",
            schemas.TechnoparkLineCategory.NON_RD_INCOME_CHANGE,
            include_period=True,
            description=(
                "Bu liste firmanın önceki aylara ait Ar-Ge Dışı Satış Gelirlerinde "
                "rapor dönemi içinde yapılan değişiklikleri ve yeni eklemeleri kapsamaktadır."
            ),
        )
        self._append_line_items(
            story,
            styles,
            report,
            "Firma Ar-Ge Gider Bilgileri",
            schemas.TechnoparkLineCategory.RD_EXPENSE,
            include_project=True,
        )
        self._append_line_items(
            story,
            styles,
            report,
            "Firma Ar-Ge Gider Bilgileri - Veri Takip Listesi",
            schemas.TechnoparkLineCategory.RD_EXPENSE_CHANGE,
            include_project=True,
            include_period=True,
            description=(
                "Bu liste firmanın önceki aylara ait Ar-Ge Giderlerinde "
                "rapor dönemi içinde yapılan değişiklikleri ve yeni eklemeleri kapsamaktadır."
            ),
        )
        self._append_line_items(
            story,
            styles,
            report,
            "Firma Ar-Ge Dışı Gider Bilgileri",
            schemas.TechnoparkLineCategory.NON_RD_EXPENSE,
        )
        self._append_line_items(
            story,
            styles,
            report,
            "Firma Ar-Ge Dışı Gider Bilgileri - Veri Takip Listesi",
            schemas.TechnoparkLineCategory.NON_RD_EXPENSE_CHANGE,
            include_period=True,
            description=(
                "Bu liste önceki aylara ait Ar-Ge Dışı Giderlerinde "
                "rapor dönemi içinde yapılan değişiklikleri ve yeni eklemeleri kapsamaktadır."
            ),
        )
        self._append_line_items(
            story,
            styles,
            report,
            "Firma FSMH Bilgileri",
            schemas.TechnoparkLineCategory.FSMH,
            include_title=True,
        )
        self._append_line_items(
            story,
            styles,
            report,
            "Firma FSMH Bilgileri - Veri Takip Listesi",
            schemas.TechnoparkLineCategory.FSMH_CHANGE,
            include_title=True,
            include_period=True,
            description=(
                "Bu liste firmanın önceki aylara ait FSMH Bilgilerinde "
                "rapor dönemi içinde yapılan değişiklikleri ve yeni eklemeleri kapsamaktadır."
            ),
        )
        self._append_line_items(
            story,
            styles,
            report,
            "Firma Muafiyet Bilgileri",
            schemas.TechnoparkLineCategory.TAX_EXEMPTION,
        )
        self._append_line_items(
            story,
            styles,
            report,
            "Firma Muafiyet Bilgileri - Veri Takip Listesi",
            schemas.TechnoparkLineCategory.TAX_EXEMPTION_CHANGE,
            include_period=True,
            description=(
                "Bu liste firmanın önceki aylara ait Vergi Muafiyetlerinde "
                "rapor dönemi içinde yapılan değişiklikleri ve yeni eklemeleri kapsamaktadır."
            ),
        )

        # Yasal Dayanaklar + hesaplamalar özeti
        story.append(Paragraph("YASAL DAYANAKLAR VE HESAPLAMA ÖZETİ", styles["Heading1"]))
        basis_rows = [["Kalem", "Dayanak", "Not"]]
        for key, value in legal_basis.items():
            basis_rows.append([
                value.get("label", key),
                value.get("law", "-"),
                value.get("note", "-"),
            ])
        basis_table = Table(basis_rows, colWidths=[5 * cm, 5.5 * cm, 5.5 * cm])
        basis_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a365d")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        self._apply_table_style(basis_table)
        story.append(basis_table)
        story.append(Spacer(1, 0.4 * cm))

        summary = [
            ["Kurumlar Vergisi İstisnası", f"{tax_result.corporate_tax.corporate_tax_exemption:,.2f}"],
            ["KDV Muafiyeti", f"{tax_result.corporate_tax.vat_exemption:,.2f}"],
            ["Personel Teşvikleri", f"{tax_result.total_personnel_incentive:,.2f}"],
            ["Toplam Vergi Avantajı", f"{tax_result.total_tax_advantage:,.2f}"],
        ]
        summary_table = Table([["Kalem", "Tutar (TL)"]] + summary, colWidths=[10 * cm, 6 * cm])
        summary_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2c5282")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
        ]))
        self._apply_table_style(summary_table)
        story.append(summary_table)

        story.append(Spacer(1, 0.5 * cm))
        story.append(Paragraph("Firma Yetkilisi ve Talep Ediliyorsa Meslek Mensubu", styles["Normal"]))
        story.append(Paragraph("İmza - Kaşe", styles["Normal"]))
        story.append(Spacer(1, 0.2 * cm))
        footer_style = ParagraphStyle(
            "Footer",
            fontName=self._font_name,
            fontSize=8,
            textColor=colors.grey,
            alignment=1,
        )
        story.append(Paragraph(
            f"Evrak Tarihi: {datetime.now().strftime('%d.%m.%Y %H:%M')}",
            footer_style,
        ))
        story.append(Paragraph("Evrak No: -", footer_style))

        doc.build(story)
        buffer.seek(0)
        return buffer

    def _append_line_items(
        self,
        story: List[Any],
        styles: Dict[str, ParagraphStyle],
        report: models.TechnoparkReport,
        title: str,
        category: schemas.TechnoparkLineCategory,
        include_project: bool = False,
        include_title: bool = False,
        include_period: bool = False,
        description: Optional[str] = None,
    ) -> None:
        story.append(Paragraph(title, styles["Heading1"]))
        if description:
            story.append(Paragraph(description, styles["Normal"]))
        items = [item for item in report.line_items if getattr(item.category, "value", item.category) == category.value]
        if not items:
            story.append(Paragraph("Listelenecek kayıt bulunamadı.", styles["Normal"]))
            story.append(Spacer(1, 0.3 * cm))
            return

        headers = []
        if include_project:
            headers.append("Proje")
        headers.append("Tür")
        if include_title:
            headers.append("Buluş Adı")
        headers.append("Tutar (TL)")
        if include_period:
            headers.append("Ay-Yıl")
            headers.append("Değiştirme/Ekleme Tarihi")

        data = [headers]
        for item in items:
            row = []
            if include_project:
                row.append(item.project_name or "-")
            row.append(item.item_type or "-")
            if include_title:
                row.append(item.title or "-")
            row.append(f"{item.amount:,.2f}")
            if include_period:
                row.append(item.period_label or "-")
                row.append(item.changed_at.strftime("%d.%m.%Y") if item.changed_at else "-")
            data.append(row)

        column_count = len(headers)
        col_width = 16 * cm / max(1, column_count)
        table = Table(data, colWidths=[col_width] * column_count)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2c5282")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("ALIGN", (-1, 1), (-1, -1), "RIGHT"),
        ]))
        self._apply_table_style(table)
        story.append(table)
        story.append(Spacer(1, 0.3 * cm))

    def _format_minutes(self, minutes: int) -> str:
        return f"{int(minutes)}s"

    def _format_hours(self, minutes: int) -> str:
        return str(int(minutes // 60))

    def _format_date_range(self, start: Optional[date], end: Optional[date]) -> str:
        start_label = start.strftime("%d.%m.%Y") if start else "-"
        end_label = end.strftime("%d.%m.%Y") if end else "-"
        return f"{start_label} - {end_label}"


def get_reporting_service(db: Session) -> ReportingService:
    """ReportingService dependency injection helper"""
    return ReportingService(db)
