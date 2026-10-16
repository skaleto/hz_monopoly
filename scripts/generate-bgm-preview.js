"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root=path.resolve(__dirname,".."),output=path.join(root,"artifacts","audio-previews"),sampleRate=44100,stepSeconds=.26,steps=48,duration=steps*stepSeconds+.8;
const profile={id:"city-drive-v2",masterGain:.42,stepMs:260};
const chords=[[261.63,329.63,392,523.25],[220,261.63,329.63,440],[174.61,220,261.63,349.23],[196,246.94,293.66,392]],lead=[0,2,1,3,2,1,3,2,0,1,2,3,1,3,2,1];
const samples=new Float64Array(Math.ceil(duration*sampleRate));

function waveform(type,phase){if(type==="triangle")return 2/Math.PI*Math.asin(Math.sin(phase));return Math.sin(phase)}
function addTone(start,frequency,toneDuration,amplitude,type="sine",delay=0){const from=Math.floor((start+delay)*sampleRate),count=Math.floor(toneDuration*sampleRate),attack=Math.max(1,Math.floor(.025*sampleRate));for(let index=0;index<count&&from+index<samples.length;index++){const age=index/sampleRate,envelope=index<attack?index/attack:Math.exp(-4.8*(index-attack)/Math.max(1,count-attack));samples[from+index]+=waveform(type,2*Math.PI*frequency*age)*amplitude*envelope*profile.masterGain}}
function addKick(start){const from=Math.floor(start*sampleRate),count=Math.floor(.18*sampleRate);let phase=0;for(let index=0;index<count&&from+index<samples.length;index++){const age=index/sampleRate,frequency=132*Math.pow(52/132,age/.12),envelope=Math.exp(-7*age/.18);phase+=2*Math.PI*frequency/sampleRate;samples[from+index]+=Math.sin(phase)*.09*envelope*profile.masterGain}}
for(let step=0;step<steps;step++){const at=step*stepSeconds,chord=chords[Math.floor(step/8)%chords.length],note=chord[lead[step%lead.length]];addTone(at,note,.34,.052,"triangle");if(step%2===0){addTone(at,chord[0]/2,.46,.068,"sine");addKick(at)}if(step%4===2)addTone(at,chord[3]*2,.16,.024,"sine",.035);if(step%8===0)addTone(at,chord[1],.72,.028,"triangle")}

let peak=0;for(const sample of samples)peak=Math.max(peak,Math.abs(sample));const scale=peak?0.82/peak:1;
const pcm=Buffer.alloc(samples.length*2);for(let index=0;index<samples.length;index++){const fade=index>samples.length-sampleRate*.5?(samples.length-index)/(sampleRate*.5):1,value=Math.max(-1,Math.min(1,samples[index]*scale*fade));pcm.writeInt16LE(Math.round(value*32767),index*2)}
const wav=Buffer.alloc(44+pcm.length);wav.write("RIFF",0);wav.writeUInt32LE(36+pcm.length,4);wav.write("WAVEfmt ",8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(sampleRate,24);wav.writeUInt32LE(sampleRate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write("data",36);wav.writeUInt32LE(pcm.length,40);pcm.copy(wav,44);
fs.mkdirSync(output,{recursive:true});const target=path.join(output,"bgm-city-drive-v2.wav");fs.writeFileSync(target,wav);fs.writeFileSync(path.join(output,"manifest.json"),`${JSON.stringify({profile,sampleRate,duration,steps,peakBeforePreviewNormalization:peak},null,2)}\n`);process.stdout.write(`${target}\n`);
