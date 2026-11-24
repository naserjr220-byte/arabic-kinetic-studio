import asyncio, json, math, re, subprocess, tempfile, unicodedata, wave, hashlib
from pathlib import Path
import edge_tts
R=Path(__file__).resolve().parents[1]
P=R/'public/research'; P.mkdir(parents=True,exist_ok=True)
OUT=R/'out/research'; OUT.mkdir(parents=True,exist_ok=True)
FPS=30; FRAMES=900; D=FRAMES/FPS
scenes=json.loads((R/'research/script.json').read_text(encoding='utf8'))
def ff(*args):subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y',*map(str,args)],check=True)
def duration(p):
 with wave.open(str(p)) as w:return w.getnframes()/w.getframerate()
def norm(s):return ''.join(c for c in unicodedata.normalize('NFC',s) if not unicodedata.category(c).startswith(('M','P')) and not c.isspace() and c!='ـ')
async def synth(text,p):
 for attempt in range(3):
  try:
   audio=bytearray(); words=[]
   async for c in edge_tts.Communicate(text,voice='ar-SA-HamedNeural',rate='+12%',boundary='WordBoundary').stream():
    if c['type']=='audio':audio.extend(c['data'])
    elif c['type']=='WordBoundary':words.append({'text':c['text'],'offset':c['offset']/1e7,'duration':c['duration']/1e7})
   assert audio and words and norm(''.join(w['text'] for w in words))==norm(text), ('WordBoundary text mismatch',words,text)
   p.write_bytes(audio);return words
  except Exception as e:
   print('TTS attempt',attempt+1,repr(e),flush=True)
   if attempt==2:raise
   await asyncio.sleep(3*(attempt+1))
async def main():
 with tempfile.TemporaryDirectory() as td:
  td=Path(td); raw=[]
  for i,s in enumerate(scenes):
   mp=td/f'{i}.mp3'; wav=td/f'{i}.wav'
   words=await synth(s['text'],mp)
   ff('-i',mp,'-ar',48000,'-ac',2,'-c:a','pcm_s16le',wav)
   raw.append((wav,duration(wav),words))
  total=sum(x[1] for x in raw); tempo=max(1,(total)/(D-1.2))
  assert tempo<=1.35, f'Narration too long: {total}'
  processed=[]
  for i,(wav,_,words) in enumerate(raw):
   dst=td/f'p{i}.wav'
   ff('-i',wav,'-af',f'atempo={tempo:.9f}' if tempo>1.000001 else 'anull','-c:a','pcm_s16le',dst)
   processed.append((dst,duration(dst),words))
  room=D-sum(x[1] for x in processed)
  assert room>=0.25,room
  gap=room/len(scenes); cursor=0.; inputs=[]; data=[]; delaymax=0.
  for i,(s,(wav,dur,words)) in enumerate(zip(scenes,processed)):
   start=round(cursor*FPS); offset=start/FPS+min(.10,gap*.25)
   end=FRAMES if i==len(scenes)-1 else round((cursor+dur+gap)*FPS)
   entries=[]
   for w in words:
    onset=offset+w['offset']/tempo; finish=min(offset+dur,onset+w['duration']/tempo)
    frame=math.ceil(onset*FPS-1e-7); assert start<=frame<end,(s,frame,end)
    delaymax=max(delaymax,frame/FPS-onset)
    entries.append({'text':w['text'],'startSeconds':onset,'endSeconds':finish,'startFrame':frame,'endFrame':max(frame+1,min(end,math.ceil(finish*FPS)))})
   key=next((w['startFrame'] for w in entries if norm(s['keyword']) in norm(w['text'])),None)
   assert key is not None,(s['keyword'],entries)
   data.append({**s,'startFrame':start,'endFrame':end,'anchorFrame':key,'words':entries})
   inputs.append((wav,round(offset*1000)));cursor+=dur+gap
  for a,b in zip(data,data[1:]):assert a['endFrame']==b['startFrame']
  cmd=['-f','lavfi','-i',f'anullsrc=r=48000:cl=stereo:d={D}']; filters=['[0:a]anull[a0]']; labels=['[a0]']
  for i,(wav,delay) in enumerate(inputs,1):
   cmd+=['-i',str(wav)]; filters.append(f'[{i}:a]adelay={delay}|{delay}[a{i}]');labels.append(f'[a{i}]')
  filters.append(''.join(labels)+f'amix=inputs={len(labels)}:duration=first:normalize=0,alimiter=limit=0.95:latency=1,atrim=duration={D}[out]')
  ff(*cmd,'-filter_complex',';'.join(filters),'-map','[out]','-ar',48000,'-ac',2,'-c:a','pcm_s16le',P/'narration.wav')
  # Align quiet pops with the semantic trigger, not an arbitrary scene timestamp.
  cmd=['-i',str(P/'narration.wav')]; filters=['[0:a]anull[a0]']; labels=['[a0]']
  for i,s in enumerate(data,1):
   cmd+=['-i',str(R/'public/audio/sfx/pop.wav')]; delay=round(s['anchorFrame']/FPS*1000)
   filters.append(f'[{i}:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.20,adelay={delay}|{delay}[a{i}]');labels.append(f'[a{i}]')
  filters.append(''.join(labels)+f'amix=inputs={len(labels)}:duration=first:normalize=0,alimiter=limit=0.95:latency=1,atrim=duration={D}[out]')
  ff(*cmd,'-filter_complex',';'.join(filters),'-map','[out]','-ar',48000,'-ac',2,'-c:a','pcm_s16le',P/'mixed.wav')
  assert abs(duration(P/'mixed.wav')-D)<.02
  timeline={'fps':FPS,'frames':FRAMES,'scenes':data}
  (R/'src/research/timeline.json').write_text(json.dumps(timeline,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
  report={'passed':True,'voice':'ar-SA-HamedNeural','rate':'+12%','tempo':tempo,'rawSpeechSeconds':total,'words':sum(len(s['words']) for s in data),'scenes':len(data),'duration':D,'maximumQuantizationDelayMs':delaymax*1000,'narrationSha256':hashlib.sha256((P/'narration.wav').read_bytes()).hexdigest(),'semanticEvents':[{'title':s['title'],'word':s['keyword'],'frame':s['anchorFrame']} for s in data]}
  (OUT/'sync-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8'); print(json.dumps(report,ensure_ascii=False),flush=True)
asyncio.run(main())
