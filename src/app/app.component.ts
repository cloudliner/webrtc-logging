import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { environment } from '../environments/environment';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/firestore';
import { AngularFireStorage } from '@angular/fire/storage';
import { Observable } from 'rxjs';
import { DomSanitizer } from '@angular/platform-browser';

declare var window: any;
declare var Peer: any;
declare var MediaRecorder: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  private roomsCollection: AngularFirestoreCollection<any>;
  rooms$: Observable<any[]>;

  _isAudioOnly = true;
  get isAudioOnly(): boolean {
    return this._isAudioOnly;
  }
  set isAudioOnly(value: boolean) {
    this._isAudioOnly = value;
    this.setupMedia();
  }

  _isRecordOnly = false;
  get isRecordOnly(): boolean {
    return this._isRecordOnly;
  }
  set isRecordOnly(value: boolean) {
    this._isRecordOnly = value;
    this.setupMedia();
  }

  videoStreams: { id: string; stream: MediaStream; inputAudio: any; }[] = [];
  mics: { label: string, deviceId: string }[] = [];
  skywayId: string;
  roomName: string;
  private localStream = null;
  private peer = null;
  private exsistingCall = null;

  private recorder = null;
  recoringText = 'Start Record';
  blobUrl = null;
  audioContext = null;
  mixedAudio = null;
  fileName = null;
  storageDownloadUrl: string = null;

  constructor(
    private ngZone: NgZone,
    private afs: AngularFirestore,
    private storage: AngularFireStorage,
    private sanitizer: DomSanitizer,
    private changeDetect: ChangeDetectorRef) {
    this.roomsCollection = afs.collection<any>('rooms');
    this.rooms$ = this.roomsCollection.valueChanges();
  }

  create(roomName: string) {
    console.log('create:', roomName);
    this.roomsCollection.add({ name: roomName });
    this.join(roomName);
  }

  join(roomName: string) {
    console.log('join:', roomName);
    if (!roomName) {
      return;
    }
    const call = this.peer.joinRoom(roomName, { mode: 'sfu', stream: this.localStream });
    this.setupCallEventHandlers(call);
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContext();
    this.mixedAudio = this.audioContext.createMediaStreamDestination();
  }

  exit() {
    console.log('exit:', this.roomName);
    this.blobUrl = null;
    this.mixedAudio = null;
    this.audioContext = null;
    this.exsistingCall.close();
  }

  setupCallEventHandlers(call) {
    if (this.exsistingCall) {
      this.exsistingCall.close();
    }
    this.exsistingCall = call;

    this.setupEndCallUI();
    this.roomName = call.name;
    call.on('stream', (stream) => {
      this.addVideo(call, stream);
    });
    call.on('removeStream', (stream) => {
      this.removeVideo(stream.peerId);
    });
    call.on('peerLeave', (peerId) => {
      this.removeVideo(peerId);
    });
    call.on('close', () => {
      this.removeAllRemoteViedos();
      this.setupMakeCallUI();
    });
  }

  addVideo(call, stream) {
    const inputAudio = this.audioContext.createMediaStreamSource(stream);
    inputAudio.connect(this.mixedAudio);
    this.videoStreams.push({
      id: stream.peerId,
      stream: stream,
      inputAudio: inputAudio,
    });
    this.changeDetect.detectChanges();
  }

  removeVideo(id) {
    const index = this.videoStreams.findIndex((videoStream) => {
      if (videoStream.id === id) {
        return true;
      }
      return false;
    });
    if (0 <= index) {
      const inputAudio = this.videoStreams[index].inputAudio;
      if (inputAudio) {
        inputAudio.disconnect(this.mixedAudio);
      }
      this.videoStreams.splice(index, 1);
    }
    this.changeDetect.detectChanges();
  }

  removeAllRemoteViedos() {
    const toBeRemoved = [];
    this.videoStreams.forEach((videoStream) => {
      if (videoStream.id !== 'localStream') {
        toBeRemoved.push(videoStream.id);
      }
    });
    toBeRemoved.forEach((id) => {
      this.removeVideo(id);
    });
  }

  setupMakeCallUI() {
    this.roomName = null;
  }

  setupEndCallUI() {
    // TODO
  }

  ngOnInit() {
    this.setupMedia();
    this.peer = new Peer({
      key: environment.skyway.apiKey,
      debug: 3,
    });
    this.peer.on('open', () => {
      this.skywayId = this.peer.id;
    });
    this.peer.on('call', (call) => {
      call.answer(this.localStream);
      this.setupCallEventHandlers(call);
    });
    this.peer.on('error', (err) => {
      alert(err.message);
    });
  }

  setupMedia() {
    this.localStream = null;
    if (! this.isRecordOnly) {
      const constraints = {
        video: ! this.isAudioOnly,
        audio: true
      };
      navigator.mediaDevices.getUserMedia(constraints)
        .then((stream) => {
          this.removeVideo('localStream');
          this.videoStreams.push({id: 'localStream', stream: stream, inputAudio: null });
          this.localStream = stream;
          if (this.exsistingCall) {
            this.exsistingCall.replaceStream(stream);
          }
        }).catch((error) => {
          console.error('mediaDevice.getUserMedia() error:', error);
          return;
        });
    } else {
      this.removeVideo('localStream');
    }

    navigator.mediaDevices.ondevicechange = () => {
      console.log('ondevicechange');
      this.ngZone.run(() => {
        this.listDevices();
      });
    };
    this.listDevices();
  }

  record() {
    if (this.recorder) {
      this.recorder.stop();
    } else {
      this.recordStream(this.mixedAudio.stream);
    }
  }

  recordStream(stream: MediaStream) {
    this.blobUrl = null;
    this.storageDownloadUrl = null;
    const chunks = [];
    const options = {
      mimeType: 'audio/webm; codecs=opus',
    };
    this.recorder = new MediaRecorder(stream, options);
    this.recorder.ondataavailable = (evt) =>  {
      console.log(`Data: evt.data.type=${evt.data.type} size=${evt.data.size}`);
      chunks.push(evt.data);
    };
    this.recorder.onstop = (evt) => {
      console.log('Stop Recording');

      // Create download link
      const audioBlob = new Blob(chunks, { type: 'audio/webm; codecs=opus' });
      const blob = window.URL.createObjectURL(audioBlob);
      this.fileName = `recorded-${ Date.now() }.webm`;
      this.blobUrl = this.sanitizer.bypassSecurityTrustResourceUrl(blob);
      this.changeDetect.detectChanges();

      (async() => {
        // Upload file
        const storageRef = this.storage.ref(this.fileName);
        await storageRef.put(audioBlob);
        console.log(`Upload File: ${ this.fileName }`);
        const metadata = {
          contentType: 'audio/webm; codecs=opus'
        };
        await storageRef.updateMetatdata(metadata).toPromise();
        await storageRef.getDownloadURL().toPromise()
          .then((downloadUrl) => {
            console.log(`Remote Download Url: ${ downloadUrl }`);
            this.storageDownloadUrl = downloadUrl;
            this.changeDetect.detectChanges();
          });

        this.recoringText = 'Start Record';
        this.changeDetect.detectChanges();
        this.recorder = null;
      })();
    };
    this.recorder.start();
    this.recoringText = 'Stop Record';
    console.log('Start Recording');
  }

  listDevices() {
    this.mics = [];
    navigator.mediaDevices.enumerateDevices()
      .then((deviceInfos) => {
        for (let i = 0; i !== deviceInfos.length; ++i) {
          const deviceInfo = deviceInfos[i];
          if (deviceInfo.kind === 'audioinput') {
            console.log(`MIC: label: ${ deviceInfo.label }, id: ${ deviceInfo.deviceId }`);
            this.mics.push(deviceInfo);
          }
        }
      })
      .catch((error) => {
        console.error('mediaDevice.enumerateDevices() error:', error);
      });
  }
}
