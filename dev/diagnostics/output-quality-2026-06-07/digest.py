import json,glob,os
def n(x):
    if isinstance(x,list): return f"[{len(x)}]"
    if isinstance(x,dict): return "{"+",".join(x.keys())+"}"
    if isinstance(x,str): return f"str({len(x)})"
    return repr(x)
files={"01-learning":"F2FmTdLtb_4","02-tech":"hX7yG1KVYhI","03-review":"e-IMMyanNAw","04-podcast":"N_ljg49De2Y","05-food":"CE6Y8tqhO4A"}
for tag,yid in files.items():
    d=json.load(open(f"{yid}.json"))
    p=d.get("pipeline",{}) or {}
    tr=p.get("triage",{}) or {}
    asm=p.get("assembly",{}) or {}
    ext=p.get("extraction",{}) or {}
    meta=d.get("meta",{}) or {}
    print("="*90)
    print(f"### {tag}  {yid}  | {d.get('title','')[:60]}")
    print(f"lang={d.get('language')} isRTL={d.get('isRTL')} hasSourceLang={'sourceLanguage' in d} dur={round((d.get('duration') or 0)/60)}m")
    print(f"primaryTag={tr.get('primaryTag')} contentTags={tr.get('contentTags')} modifiers={tr.get('modifiers')} format={tr.get('contentFormat')} conf={tr.get('confidence')}")
    print(f"userGoal: {tr.get('userGoal','')[:160]}")
    print("\n-- PLAN tabs (id | component | dataSource | goal) --")
    for t in tr.get("tabs",[]):
        print(f"  [{t.get('id')}] {t.get('emoji','')} '{t.get('label')}' -> {t.get('component')}  src={t.get('dataSource')}")
        print(f"       goal: {(t.get('goal') or '')[:140]}")
    print("\n-- ASSEMBLY --")
    def lst(x): 
        return [ (i.get('id') if isinstance(i,dict) else i) for i in x] if isinstance(x,list) else x
    print(f"  tabsDesigned={lst(asm.get('tabsDesigned'))}")
    print(f"  tabsAssembled={lst(asm.get('tabsAssembled'))}")
    print(f"  tabsDropped={asm.get('tabsDropped')}")
    print("\n-- EXTRACTION (domain -> field -> count) --")
    for dom,v in ext.items():
        if isinstance(v,dict):
            print(f"  {dom}: "+", ".join(f"{k}={n(val)}" for k,val in v.items()))
        else:
            print(f"  {dom}: {n(v)}")
    print("\n-- ASSEMBLED tabs (rendered props) --")
    for t in d.get("tabs",[]):
        props=t.get("props",{}) or {}
        psum=", ".join(f"{k}={n(val)}" for k,val in props.items())
        print(f"  [{t.get('id')}] {t.get('component')} '{t.get('label')}' :: {psum}")
    print(f"\n-- meta.extractionCoverage: {json.dumps(meta.get('extractionCoverage'))}")
    print()
