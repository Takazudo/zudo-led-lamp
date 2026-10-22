"""One owned Docker container, GitHub-hosted Ubuntu only. Artifact-only."""
import os,json,subprocess,time,uuid,hashlib,shutil,signal
from pathlib import Path
from bounded_process import run as bounded_run
IMAGE='kicad/kicad@sha256:18693567392b80da435f9fa952ce3a3e534c66eb5a6033f5b9c80aa3b19dd3ec'
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
OUT=ROOT/'native-output'
def owned(obj,name,label,cid=None):
    if obj['Name']!='/'+name or obj['Config']['Labels'].get('husb006.owner')!=label:raise RuntimeError('Container ownership mismatch')
    if cid and obj['Id']!=cid:raise RuntimeError('Container ID mismatch')
def manifest_check():
    expected=json.loads((HERE/'PUBLIC-MANIFEST.json').read_text())
    actual={p.relative_to(ROOT).as_posix() for p in HERE.rglob('*') if p.is_file() or p.is_symlink()}
    actual.remove('verification/husb006/PUBLIC-MANIFEST.json')
    actual.add('.github/workflows/husb006-native-check.yml')
    if actual!=set(expected):raise RuntimeError('Unexpected/missing publication inputs')
    for name,digest in expected.items():
        rel=Path(name)
        if rel.is_absolute() or '..' in rel.parts or '\\' in name:raise RuntimeError('Unsafe manifest path')
        p=ROOT/name
        if any(q.is_symlink() for q in [p,*p.parents]) or not p.is_file() or not p.resolve().is_relative_to(ROOT.resolve()) or hashlib.sha256(p.read_bytes()).hexdigest()!=digest:raise RuntimeError('Input manifest mismatch '+name)
    return expected
def main():
    if os.environ.get('GITHUB_ACTIONS')!='true' or os.environ.get('RUNNER_ENVIRONMENT')!='github-hosted' or os.environ.get('RUNNER_OS')!='Linux':raise RuntimeError('Only GitHub-hosted Linux execution authorized')
    OUT.mkdir(exist_ok=False)
    receipt={'status':'SETUP','image':IMAGE,'source_commit':os.environ.get('GITHUB_SHA'),'limits':{'cpus':2,'memory_mib':4096,'pids':512,'controller_seconds':900,'container_seconds':540,'log_bytes':2097152,'artifact_bytes':26214400,'retention_days':7}}
    start=time.monotonic();deadline=start+900;work_deadline=deadline-180;cleaning=False;cid=None;name='husb006-'+uuid.uuid4().hex;label=uuid.uuid4().hex
    receipt['command_capture']=[]
    def save(): (OUT/'host.json').write_text(json.dumps(receipt,indent=2))
    def call(args,limit=60):
        available=min(limit,(deadline if cleaning else work_deadline)-time.monotonic())
        if available<=0:raise RuntimeError('Controller deadline expired')
        def output_bound():
            total=0
            for p in OUT.rglob('*'):
                if p.is_symlink():raise RuntimeError('Symlink output')
                if p.is_file():total+=p.stat().st_size
            if total>32*1024*1024:raise RuntimeError('32MiB total output threshold exceeded')
        result=bounded_run(args,available,monitor=None if cleaning else output_bound)
        name_log=f'host-command-{len(receipt["command_capture"]):02}.log'
        (OUT/name_log).write_bytes(result.stdout)
        receipt['command_capture'].append({'argv':args[:3],'seconds':result.seconds,'exit':result.returncode,'failure':result.failure,'log':name_log});save()
        if result.failure:raise RuntimeError(result.failure+'; first output retained in '+name_log)
        return result
    def checked(args,limit=60):
        p=call(args,limit)
        if p.returncode:raise RuntimeError(f'{args[:3]} exited {p.returncode}: {p.stdout[:2000].decode(errors="replace")}')
        return p.stdout.decode().strip()
    def inspect(identity):
        obj=json.loads(checked(['docker','inspect',identity],15 if cleaning else 60))[0]
        owned(obj,name,label,cid)
        return obj
    save()
    def interrupted(signum,frame):raise RuntimeError('Termination signal '+str(signum))
    signal.signal(signal.SIGTERM,interrupted);signal.signal(signal.SIGINT,interrupted)
    try:
        before=manifest_check();receipt['manifest_entries']=len(before)
        checked(['docker','pull',IMAGE],180)
        args=['docker','create','--name',name,'--label','husb006.owner='+label,'--network','none','--cpus','2','--memory','4g','--memory-swap','4g','--pids-limit','512','--read-only','--tmpfs','/tmp:rw,nosuid,size=512m','--user',f'{os.getuid()}:{os.getgid()}','-e','HOME=/tmp','-e','XDG_CONFIG_HOME=/tmp/config','-e','XDG_CACHE_HOME=/tmp/cache','-e','PYTHONDONTWRITEBYTECODE=1','-e','OMP_NUM_THREADS=1','-v',str(ROOT)+':/input:ro','-v',str(OUT)+':/output:rw','--entrypoint','python3',IMAGE,'-B','/input/verification/husb006/native_probe.py']
        cid=checked(args,45);receipt['container_id']=cid;save()
        inspect(cid)
        result=call(['docker','start','--attach',cid],540)
        if len(result.stdout)>2097152:raise RuntimeError('Container log cap exceeded')
        (OUT/'container.log').write_bytes(result.stdout)
        state=inspect(cid)['State'];receipt['container_state']=state
        if state['Running'] or result.returncode or state['ExitCode']:raise RuntimeError('Native container failed; inspect saved outputs')
        if manifest_check()!=before:raise RuntimeError('Original inputs changed')
        receipt['status']='COMPLETED';receipt['inputs_unchanged']=True
    except Exception as exc:
        receipt['status']='FAILED';receipt['error']=str(exc)
    finally:
        cleaning=True
        # Reserved controller time remains after max pull/create/native durations.
        try:
            obj=inspect(cid or name)
            actual=obj['Id']
            checked(['docker','rm','--force',actual],30)
            remaining=checked(['docker','ps','-aq','--no-trunc','--filter','id='+actual],15)
            if remaining:raise RuntimeError('Owned container still present')
            receipt['cleanup']='CONFIRMED_REMOVED'
        except Exception as exc:
            receipt['cleanup']='UNCONFIRMED';receipt['cleanup_error']=str(exc);receipt['status']='FAILED'
        receipt['elapsed_seconds']=time.monotonic()-start;save()
    # Small explicit output allowlist; no source/PDF/cache/workspace archive.
    stage=ROOT/'upload-safe';stage.mkdir(exist_ok=True)
    if stage.is_symlink() or any(p.name!='host.json' or p.is_symlink() or not p.is_file() for p in stage.iterdir()):raise RuntimeError('Unexpected initial artifact staging')
    allowed={'host.json','native.json','container.log','version.log','erc.log','erc.json','netlist.log','candidate.xml','connectivity.log','schematic-svg.log','footprints.json'}
    allowed.update(x['log'] for x in receipt['command_capture'])
    total=0
    try:
        planned=[]
        for p in OUT.rglob('*'):
            if p.is_dir() and not p.is_symlink():continue
            rel=p.relative_to(OUT)
            if p.is_symlink() or not p.is_file() or not (rel.as_posix() in allowed or (rel.parent.as_posix()=='schematic-svg' and p.suffix=='.svg')):raise RuntimeError('Artifact allowlist violation')
            total+=p.stat().st_size
            if total>26214400:raise RuntimeError('Artifact cap exceeded')
            planned.append((p,stage/rel))
        for p,q in planned:q.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,q)
    except Exception as exc:
        receipt['status']='FAILED';receipt['artifact_error']=str(exc);save()
        shutil.copyfile(OUT/'host.json',stage/'host.json')
    print(json.dumps(receipt,indent=2))
    if receipt['status']!='COMPLETED':raise SystemExit(1)
if __name__=='__main__':main()
