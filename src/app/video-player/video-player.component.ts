import { Component, OnInit, OnDestroy, Input, ViewChild, ElementRef, NgZone } from '@angular/core';
import { EventInfo, MediaStreamTrackEventInfo } from '../info/EventInfo';

declare var window: any;
@Component({
  selector: 'app-video-player',
  templateUrl: './video-player.component.html',
  styleUrls: ['./video-player.component.css']
})
export class VideoPlayerComponent implements OnInit {
  @Input() stream: MediaStream;
  @Input() id: string;
  @ViewChild('videoPlayer', { read: ElementRef, static: true } ) videoPlayer: ElementRef;
  @ViewChild('audioPlayer', { read: ElementRef, static: true } ) audioPlayer: ElementRef;
  @ViewChild('audioLevel', { read: ElementRef, static: true } ) audioLevel: ElementRef;

  hasVideo = true;

  audioTracks: MediaStreamTrack[] = [];
  events: string[] = [];

  private analyserNode: AnalyserNode;
  private drawInterval: number;

  constructor(private ngZone: NgZone) {}

  ngOnInit(): void {
    // tslint:disable-next-line:variable-name
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();
    const sourceNode = audioContext.createMediaStreamSource(this.stream);
    this.analyserNode = audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;
    sourceNode.connect(this.analyserNode);

    const videoTracks = this.stream.getVideoTracks();
    if (videoTracks.length === 0) {
      this.hasVideo = false;
      this.audioPlayer.nativeElement.srcObject = this.stream;
      if (this.id === 'localStream') {
        this.audioPlayer.nativeElement.muted = true;
      }
    } else {
      this.hasVideo = true;
      this.videoPlayer.nativeElement.srcObject = this.stream;
      if (this.id === 'localStream') {
        this.videoPlayer.nativeElement.muted = true;
      }
    }
    this.audioTracks = this.stream.getAudioTracks();
    for (const audioTrack of this.audioTracks) {
      audioTrack.onended = (ev: Event) => {
        console.log(`onended: ${JSON.stringify(ev)}`);
        this.ngZone.run(() => {
          this.events.push(`onended: ${ new EventInfo(ev).toString() }`);
        });
      };
      audioTrack.onmute = (ev: Event) => {
        console.log(`onmute: ${JSON.stringify(ev)}`);
        this.ngZone.run(() => {
          this.events.push(`onmute: ${ new EventInfo(ev).toString() }`);
        });
      };
      audioTrack.onunmute = (ev: Event) => {
        console.log(`onunmute: ${ new EventInfo(ev).toString() }`);
        this.ngZone.run(() => {
          this.events.push(`onunmute: ${ new EventInfo(ev).toString() }`);
        });
      };
    }
    this.stream.onaddtrack = (ev: MediaStreamTrackEvent) => {
      console.log(`onaddtrack: ${ new MediaStreamTrackEventInfo(ev).toString() }`);
      this.ngZone.run(() => {
        this.events.push(`onaddtrack: ${ new MediaStreamTrackEventInfo(ev).toString() }`);
      });
    };
    this.stream.onremovetrack = (ev: MediaStreamTrackEvent) => {
      console.log(`onremovetrack: ${ new MediaStreamTrackEventInfo(ev).toString() }`);
      this.ngZone.run(() => {
        this.events.push(`onremovetrack: ${ new MediaStreamTrackEventInfo(ev).toString() }`);
      });
    };
    this.ngZone.runOutsideAngular(() => {
      this.drawInterval = window.setInterval(() => {
        this.drawAudioLevel();
      }, 100);
    });
  }

  onNgDestroy(): void {
    window.clearInterval(this.drawInterval);
  }

  drawAudioLevel() {
    if (!this.audioLevel || !this.analyserNode) {
      return;
    }
    const canvas = this.audioLevel.nativeElement;
    const drawContext = canvas.getContext('2d');
    const barWidth = canvas.width / this.analyserNode.fftSize;
    const array = new Uint8Array(this.analyserNode.fftSize);
    this.analyserNode.getByteTimeDomainData(array);
    drawContext.fillStyle = 'rgba(0, 0, 0, 1)';
    drawContext.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < this.analyserNode.fftSize; ++i) {
      const value = array[i];
      const percent = value / 255;
      const height = canvas.height * percent;
      const offset = canvas.height - height;

      drawContext.fillStyle = 'lime';
      drawContext.fillRect(i * barWidth, offset, barWidth, 2);
    }
  }
}
