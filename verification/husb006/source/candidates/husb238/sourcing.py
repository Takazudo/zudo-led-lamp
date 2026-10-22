"""Candidate identities, not a manufacturing BOM or stock commitment."""
# mpn, JLC ID, package, evidence status. Exact sources in BOM-CLOSURE.md.
PARTS = {
 'QINH':('SMMBT3904LT1G','C84555','SOT-23','JLC Economic/Standard; onsemi Rev15'),
 'RG':('RT0603BRD07100KL','C122538','0603','JLC Economic/Standard; YAGEO RT'),
 'RB':('RT0603BRD07100KL','C122538','0603','JLC Economic/Standard; YAGEO RT'),
 'RBE':('RC0603FR-071ML','C105578','0603','JLC Economic/Standard; manufacturer RC detail pending'),
 'RUVH':('RT0603BRD0797K6L','C861608','0603','JLC Economic/Standard; YAGEO RT'),
 'RUVL':('RT0603BRD0710KL','C95204','0603','Exact repository/LCSC identity; current JLC HTTP429, eligibility pending'),
 'ROVH':('RT0603BRD07133KL','C861111','0603','JLC Economic/Standard; YAGEO RT'),
 'ROVL':('RT0603BRD0710KL','C95204','0603','Exact repository/LCSC identity; current JLC HTTP429, eligibility pending'),
 'RILM':('RC0603FR-071K27L','C245930','0603','JLC Economic/Standard; manufacturer RC detail pending'),
 'RSLEW':('0603WAF1000T5E','C22775','0603','Existing LED exact identity; present eligibility not refreshed'),
 'RBLEED':('1210W2F2201T5E','C422361','1210','JLC Economic/Standard; manufacturer thermal/land details pending'),
 'RVSET':('0603WAF1402T5E','C22803','0603','JLC Economic/Standard; decoder corners still pending'),
 'RISET':('0603WAF2262T5E','C22959','0603','JLC Economic/Standard; decoder corners still pending'),
 'CSLEW':('UNSELECTED','','22nF C0G 50V','Exact JLC identity pending; do not silently substitute X7R'),
}

def apply(spec):
    for ref,(mpn,jlc,package,status) in PARTS.items():
        old=spec.COMPONENTS[ref]
        symbol='SMMBT3904LT1G' if ref=='QINH' else old[0]
        value=old[1].split(' - ')[0]+' / '+mpn
        if ref=='QINH': value='SMMBT3904LT1G / onsemi'
        # Known package name is not a verified land pattern. Keep blank when
        # new footprint verification is absent; reuse existing R0603 only.
        footprint='zudo-led-lamp:R0603' if package=='0603' else old[3]
        spec.COMPONENTS[ref]=(symbol,value,jlc,footprint,old[4],old[5])
