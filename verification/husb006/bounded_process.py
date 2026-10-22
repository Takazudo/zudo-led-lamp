"""Incremental fixed-size log capture, timeout and optional output monitor."""
import subprocess,threading,time
from types import SimpleNamespace
def run(args,timeout,cap=2097152,monitor=None):
    start=time.monotonic();buf=bytearray();overflow=threading.Event()
    p=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    def read():
        while True:
            data=p.stdout.read(4096)
            if not data:break
            keep=max(0,cap-len(buf));buf.extend(data[:keep])
            if len(data)>keep:overflow.set()
    t=threading.Thread(target=read,daemon=True);t.start()
    reason=None
    try:
        while p.poll() is None:
            if overflow.is_set():reason='LOG_LIMIT'
            elif time.monotonic()-start>=timeout:reason='TIMEOUT'
            elif monitor:
                try:monitor()
                except Exception as exc:reason='OUTPUT_MONITOR: '+str(exc)
            if reason:break
            time.sleep(.05)
    except BaseException as exc:
        reason='INTERRUPTED: '+type(exc).__name__+': '+str(exc)
    finally:
        if p.poll() is None:p.kill()
        p.wait(timeout=5);t.join(timeout=5)
    if t.is_alive():reason=reason or 'LOG_READER_NOT_CLOSED'
    if not t.is_alive():p.stdout.close()
    if overflow.is_set():reason=reason or 'LOG_LIMIT'
    return SimpleNamespace(stdout=bytes(buf),returncode=p.returncode,failure=reason,seconds=time.monotonic()-start)
