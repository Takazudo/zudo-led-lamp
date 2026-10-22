"""Compare an actual future KiCad XML export; no native run is implied."""
import json,sys,xml.etree.ElementTree as ET
def check(xml_path,expect_path):
    with open(expect_path,encoding='utf-8') as f:e=json.load(f)
    tree=ET.parse(xml_path)
    records=[c.attrib['ref'] for c in tree.findall('./components/comp')]
    refs=set(records)
    assert len(records)==len(refs),'Duplicate component records'
    assert refs==set(e['components']),f'Component mismatch: {refs ^ set(e["components"])}'
    expected={}
    for name,pins in e['nets'].items():
        for p in pins:
            assert p not in expected,p
            expected[p]=frozenset(pins)
    for p in e['no_connect']:
        assert p not in expected,f'Conflicting or duplicate NC fixture {p}'
        expected[p]=frozenset([p])
    actual={}
    for net in tree.findall('./nets/net'):
        nodes=[n.attrib['ref']+'.'+n.attrib['pin'] for n in net.findall('node')]
        pins=frozenset(nodes)
        assert len(nodes)==len(pins),'Duplicate pin nodes within net'
        for p in pins:
            assert p in expected,f'Unexpected exported pin {p}'
            assert p not in actual,f'Pin exported in multiple nets {p}'
            actual[p]=pins
            assert pins==expected[p],f'Connectivity mismatch {p}: {sorted(pins)} != {sorted(expected[p])}'
    for p,group in expected.items():
        # Unconnected/single-pin nets may be omitted by native exporter.
        if len(group)>1:assert actual.get(p)==group,f'Missing connected pin {p}'
    print(f'Native XML connectivity matches {len(refs)} references; electrical/native acceptance NOT implied.')
if __name__=='__main__':check(*sys.argv[1:])
