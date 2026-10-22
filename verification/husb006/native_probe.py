"""Fixed operations inside pinned disposable container; no routing/refill/adoption."""
import json,subprocess,time,resource,hashlib
from pathlib import Path
from bounded_process import run as bounded_run
ROOT=Path('/input/verification/husb006')
OUT=Path('/output')
SCH=ROOT/'source/candidates/husb238/u1-integration/shared-p-u1-candidate.kicad_sch'
def main():
    receipt={'status':'STARTED','operations':[],'acceptance':'NOT_MANUFACTURING_ACCEPTANCE'}
    def save(): (OUT/'native.json').write_text(json.dumps(receipt,indent=2))
    def run(name,args,allowed=(0,),seconds=120):
        start=time.monotonic()
        p=bounded_run(args,seconds)
        (OUT/(name+'.log')).write_bytes(p.stdout)
        receipt['operations'].append({'name':name,'argv':args,'exit':p.returncode,'seconds':time.monotonic()-start,'failure':p.failure})
        save()
        if p.failure or p.returncode not in allowed:raise RuntimeError(f'{name} exit {p.returncode}: {p.failure}')
        return p.stdout.decode(errors='replace').strip(),p.returncode
    save()
    try:
        # Per-file ceiling plus host total-output monitor. This may terminate a
        # large export; that is a preserved failure, never implicit truncation.
        resource.setrlimit(resource.RLIMIT_FSIZE,(8*1024*1024,8*1024*1024))
        version,_=run('version',['kicad-cli','version'])
        if version!='10.0.6':raise RuntimeError('Unexpected pinned CLI version '+version)
        receipt['cli_version']=version
        # Keep ERC violations visible; exit5 is a reportable violation result, not zero ERC.
        _,erc_exit=run('erc',['kicad-cli','sch','erc','--format','json','--exit-code-violations','-o',str(OUT/'erc.json'),str(SCH)],(0,5),180)
        receipt['erc_exit']=erc_exit
        run('netlist',['kicad-cli','sch','export','netlist','--format','kicadxml','-o',str(OUT/'candidate.xml'),str(SCH)])
        run('connectivity',['python3','-B',str(ROOT/'check_native_netlist.py'),str(OUT/'candidate.xml'),str(ROOT/'expectations.json')])
        run('schematic-svg',['kicad-cli','sch','export','svg','-o',str(OUT/'schematic-svg'),str(SCH)])
        import pcbnew
        receipt['pcbnew_version']=pcbnew.GetBuildVersion()
        libs=SCH.parent
        expect=json.loads((ROOT/'expectations.json').read_text())
        rows=[]
        for ref,c in expect['components'].items():
            if not c['footprint']:
                if ref!='CSLEW':raise RuntimeError('Unexpected blank footprint '+ref)
                rows.append({'ref':ref,'status':'UNRESOLVED_CSLEW_GEOMETRY'});continue
            lib,name=c['footprint'].split(':')
            folder='inherited.pretty' if lib=='zudo-led-lamp' else 'husb-candidate.pretty'
            fp=pcbnew.FootprintLoad(str(libs/folder),name)
            if fp is None:raise RuntimeError('Footprint failed to load '+name)
            pads=[]
            for pad in fp.Pads():
                pos=pad.GetPosition();size=pad.GetSize()
                pads.append({'number':pad.GetNumber(),'x_mm':pos.x/1e6,'y_mm':pos.y/1e6,'w_mm':size.x/1e6,'h_mm':size.y/1e6,'shape':int(pad.GetShape())})
            numbered={p['number']:p for p in pads if p['number']}
            if ref in ('U1','U2','QINH','RBLEED'):
                count={'U1':11,'U2':10,'QINH':3,'RBLEED':2}[ref]
                if set(numbered)!={str(i) for i in range(1,count+1)}:raise RuntimeError('Pad identity mismatch '+ref)
                if len(numbered)!=sum(bool(p['number']) for p in pads):raise RuntimeError('Duplicate numbered source pad '+ref)
            def at(pin,x,y):
                p=numbered[str(pin)]
                if abs(p['x_mm']-x)>1e-5 or abs(p['y_mm']-y)>1e-5:raise RuntimeError(f'{ref}.{pin} orientation mismatch')
            if ref=='U1':at(1,-1.4,-1);at(6,1.4,1);at(11,0,0)
            if ref=='U2':
                for pin,x,y in [(1,-.9,-.7),(4,-.9,.7),(5,-.25,0),(6,.25,0),(7,.9,.7),(10,.9,-.7),(2,-.9,-.225),(3,-.9,.225),(8,.9,.225),(9,.9,-.225)]:at(pin,x,y)
                for pin in (1,4,7,10):
                    if numbered[str(pin)]['shape']!=int(pcbnew.PAD_SHAPE_CUSTOM):raise RuntimeError('L corner lost custom geometry')
                if sum(not p['number'] for p in pads)!=8:raise RuntimeError('U2 paste aperture count mismatch')
            if ref=='QINH':at(1,-.95,.975);at(2,.95,.975);at(3,0,-.975)
            rows.append({'ref':ref,'status':'NATIVE_LOADED_IDENTITY_CHECKED' if ref in ('U1','U2','QINH','RBLEED') else 'NATIVE_LOADED_INHERITED','pads':pads})
        (OUT/'footprints.json').write_text(json.dumps(rows,indent=2))
        receipt['status']='CHECKS_COMPLETED_WITH_ERC_FINDINGS' if erc_exit else 'CHECKS_COMPLETED'
        receipt['remaining']=['CSLEW footprint','M17 courtyard/mechanical qualification','effective mask/paste plots and process','PCB layout/DRC/CPL','electrical startup/fallback/physical tests']
    except Exception as exc:
        receipt['status']='FAILED';receipt['error']=str(exc);raise
    finally:
        receipt['max_rss_self_kib']=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        receipt['max_rss_child_kib']=resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss
        save()
if __name__=='__main__':main()
