import json, subprocess, re
from pathlib import Path
p=Path('out/research/final-video.mp4')
d=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(p)]))
v=next(s for s in d['streams'] if s['codec_type']=='video');a=next(s for s in d['streams'] if s['codec_type']=='audio')
assert (v['width'],v['height'],v['avg_frame_rate'],int(v['nb_read_frames']),v['codec_name'])==(1080,1920,'30/1',900,'h264')
assert a['codec_name']=='aac' and int(a['sample_rate'])==48000 and abs(float(d['format']['duration'])-30)<.1
log=subprocess.run(['ffmpeg','-hide_banner','-i',str(p),'-af','volumedetect','-f','null','-'],capture_output=True,text=True,check=True).stderr
peak=float(re.search(r'max_volume:\s*(-?[\d.]+) dB',log).group(1));assert -35<peak<0
subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(p),'-f','null','-'],check=True)
Path('out/research/render-validation.json').write_text(json.dumps({'passed':True,'peakDbfs':peak,'ffprobe':d},indent=2)+'\n')
print('RENDER VALIDATION PASS',peak)
