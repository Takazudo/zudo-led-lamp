"""Offline refusal controls. No Docker, KiCad, network or physical calls."""
import unittest,tempfile,os,json,hashlib,sys
from pathlib import Path
from unittest.mock import patch
import run_hosted as h
from bounded_process import run
class Refusals(unittest.TestCase):
 def test_not_hosted_refused_before_commands(self):
  with patch.dict(os.environ,{'GITHUB_ACTIONS':'false'}),patch.object(h.subprocess,'run') as command:
   with self.assertRaises(RuntimeError):h.main()
   command.assert_not_called()
 def test_identity_and_ownership_mismatch(self):
  obj={'Name':'/owned','Id':'123','Config':{'Labels':{'husb006.owner':'token'}}}
  h.owned(obj,'owned','token','123')
  for name,label,cid in [('other','token','123'),('owned','wrong','123'),('owned','token','456')]:
   with self.assertRaises(RuntimeError):h.owned(obj,name,label,cid)
 def test_manifest_hash_and_missing_input_fail(self):
  with tempfile.TemporaryDirectory() as t:
   p=Path(t);here=p/'verification/husb006';here.mkdir(parents=True);x=here/'x';x.write_text('frozen')
   wf=p/'.github/workflows/husb006-native-check.yml';wf.parent.mkdir(parents=True);wf.write_text('test')
   m={q.relative_to(p).as_posix():hashlib.sha256(q.read_bytes()).hexdigest() for q in (x,wf)}
   (here/'PUBLIC-MANIFEST.json').write_text(json.dumps(m))
   with patch.object(h,'ROOT',p),patch.object(h,'HERE',here):
    h.manifest_check();x.write_text('changed')
    with self.assertRaises(RuntimeError):h.manifest_check()
    x.unlink()
    with self.assertRaises(RuntimeError):h.manifest_check()
    x.write_text('frozen');(here/'extra').write_text('unexpected')
    with self.assertRaises(RuntimeError):h.manifest_check()
 def test_live_capture_limits_and_first_output(self):
  r=run([sys.executable,'-u','-c','print("x"*10000)'],3,cap=1024)
  self.assertEqual(len(r.stdout),1024);self.assertEqual(r.failure,'LOG_LIMIT')
  r=run([sys.executable,'-u','-c','import time;print("before-timeout",flush=True);time.sleep(5)'],.5)
  self.assertEqual(r.failure,'TIMEOUT');self.assertIn(b'before-timeout',r.stdout)
  def interrupt():raise KeyboardInterrupt('synthetic cancellation')
  r=run([sys.executable,'-u','-c','import time;time.sleep(5)'],3,monitor=interrupt)
  self.assertIn('INTERRUPTED: KeyboardInterrupt',r.failure);self.assertIsNotNone(r.returncode)
if __name__=='__main__':unittest.main()
