import argparse, hashlib, json, math, re, subprocess, unicodedata, wave
from pathlib import Path
R=Path(__file__).resolve().parents[1]
def load(p):return json.loads((R/p).read_text(encoding='utf-8'))
def norm(s):return ''.join(c for c in unicodedata.normalize('NFC',s) if not unicodedata.category(c).startswith(('M','P')) and c!='ـ')
a=argparse.ArgumentParser();a.add_argument('--video');args=a.parse_args()
d=load('src/data/timeline.json');p=d['project'];w=load('public/audio/narration-word-timings.json')['words'];report=load('reference/sync-report.json');fps=p['fps'];total=p['durationFrames']
assert d['wordTimings']==w
assert [norm(x['text']) for x in w]==norm(d['narrationText']).split()
assert hashlib.sha256((R/'public/audio/narration.wav').read_bytes()).hexdigest()==report['narrationSha256']
events=[];end=0;actual={}
for s in d['scenes']:
 assert s['startFrame']==end;end=s['endFrame'];assert s['startFrame']<end;events+=s['wordEvents']
 assert (R/'public'/s['mainElement']['src']).is_file()
 for x in s['mainElement'].get('imageEvents',[]):assert (R/'public'/x['src']).is_file()
 for x in s['mainElement'].get('imageEvents',[])+s['stickerEvents']+s['sfxEvents']:actual[x['id']]=x.get('startFrame',x.get('atFrame'))
assert end==total and len(events)==len(w)==38
for e,x in zip(events,w):
 assert e['text']==x['text'] and e['startFrame']==math.ceil(x['startSeconds']*fps-1e-7)
 assert e['startFrame']<e['endFrame']<=total
assert len(actual)==len(report['semanticEvents'])==23
for item in report['semanticEvents']:assert actual[item['id']]==events[item['wordIndex']-1]['startFrame']
for path in ['narration.wav','mixed_narration.wav']:
 with wave.open(str(R/'public/audio'/path)) as audio:
  assert audio.getframerate()==48000 and audio.getnchannels()==2 and abs(audio.getnframes()/48000-total/fps)<.02
result={'wordCount':len(w),'semanticEvents':len(actual),'frames':total,'maxEntryDelayMs':max((e['startFrame']/fps-x['startSeconds'])*1000 for e,x in zip(events,w)),'passed':True}
if args.video:
 video=R/args.video
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(video)]))
 v=next(s for s in probe['streams'] if s['codec_type']=='video');au=next(s for s in probe['streams'] if s['codec_type']=='audio')
 assert (v['width'],v['height'],int(v['nb_read_frames']),v['codec_name'],v['avg_frame_rate'])==(p['width'],p['height'],total,'h264',f'{fps}/1')
 assert au['codec_name']=='aac' and int(au['sample_rate'])==48000 and au['channels']==2 and abs(float(probe['format']['duration'])-total/fps)<.1
 log=subprocess.run(['ffmpeg','-v','info','-i',str(video),'-af','volumedetect','-f','null','-'],capture_output=True,text=True,check=True).stderr
 peak=float(re.search(r'max_volume:\s*(-?[\d.]+) dB',log).group(1));assert -40<peak<0
 result.update(peakDbfs=peak,ffprobe=probe)
(R/'out').mkdir(exist_ok=True)
(R/'out'/('render-validation.json' if args.video else 'sync-validation.json')).write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='ffprobe'},indent=2))
