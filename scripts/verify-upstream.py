"""Usage: python scripts/verify-upstream.py /path/to/x-algorithm
Checks pinned commit and every configured weight; no network or credentials.
"""
import pathlib, re, subprocess, sys
upstream=pathlib.Path(sys.argv[1])
source=(upstream/'home-mixer/params/param.rs').read_text()
engine=pathlib.Path('lib/engine.ts').read_text()
sha=re.search(r"SOURCE_SHA = '([^']+)'",engine).group(1)
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=upstream,text=True).strip()==sha
weights=re.search(r'export const WEIGHTS = \{(.*?)\} as const',engine,re.S).group(1)
actual={k:float(v) for k,v in re.findall(r'(\w+):\s*(-?[\d.]+)',weights)}
params={k:float(v) for k,v in re.findall(r'param!\(\s*(\w+Weight),\s*f64,\s*"[^"]+",\s*(-?[\d.]+)\s*\);',source)}
for head,value in actual.items():
    name=''.join(s.title() for s in head.split('_'))+'Weight'
    if head=='dwell_time': name='ContDwellTimeWeight'
    if head=='click_dwell_time': name='ContClickDwellTimeWeight'
    assert value==params[name],(head,value,params[name])
print(f'All {len(actual)} weights match source {sha[:7]}.')
