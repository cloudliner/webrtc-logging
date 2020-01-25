import { Component, OnInit, Input, ViewChild, ElementRef } from '@angular/core';

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

  ngOnInit(): void {
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
  }
}
