import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { environment } from '../environments/environment';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/firestore';
import { AngularFireStorage } from '@angular/fire/storage';
import { Observable } from 'rxjs';
import { DomSanitizer } from '@angular/platform-browser';
import { EventInfo } from './info/EventInfo';

declare var window: any;
declare var Peer: any;
declare var MediaRecorder: any;

export class VideoStream {
  id: string;
  stream?: MediaStream;
  inputAudio?: any;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  // private roomsCollection: AngularFirestoreCollection<any>;
  // rooms$: Observable<any[]>;

  _isAudioOnly = true;
  get isAudioOnly(): boolean {
    return this._isAudioOnly;
  }
  set isAudioOnly(value: boolean) {
    this._isAudioOnly = value;
    this.setupMedia();
  }

  _isReceiveOnly = true;
  get isReceiveOnly(): boolean {
    return this._isReceiveOnly;
  }
  set isReceiveOnly(value: boolean) {
    this._isReceiveOnly = value;
    this.setupMedia();
  }

  videoStreams: VideoStream[] = [];
  mics: { label: string, deviceId: string }[] = [];
  events: string[] = [];
  skywayId: string;
  roomName: string;
  localStream: MediaStream = null;
  private peer = null;
  private exsistingSfuRoom = null;

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
    // this.roomsCollection = afs.collection<any>('rooms');
    // this.rooms$ = this.roomsCollection.valueChanges();
    // tslint:disable-next-line:variable-name
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContext();
    this.mixedAudio = this.audioContext.createMediaStreamDestination();
  }

  join() {
    const name = 'Test';
    console.log('join:', name);
    const sfuRoom = this.peer.joinRoom(name, { mode: 'sfu', stream: this.localStream });
    this.setupCallEventHandlers(sfuRoom);
  }

  exit() {
    console.log('exit:', this.roomName);
    this.blobUrl = null;
    this.exsistingSfuRoom.close();
  }

  setupCallEventHandlers(sfuRoom) {
    if (this.exsistingSfuRoom) {
      this.exsistingSfuRoom.close();
    }
    this.exsistingSfuRoom = sfuRoom;

    this.setupEndCallUI();
    this.roomName = sfuRoom.name;
    sfuRoom.on('open', (peerId: string) => {
      console.log(`open: ${sfuRoom.name}`);
      console.log(` sfuRoom.members: ${ JSON.stringify(sfuRoom.members) }`);
      console.log(` sfuRoom.remoteStreams: ${ JSON.stringify(sfuRoom.remoteStreams) }`);
      this.addAllParticipants(sfuRoom);
    });
    sfuRoom.on('peerJoin', (peerId: string) => {
      console.log(`peerJoin: ${peerId}`);
      console.log(` sfuRoom.members: ${ JSON.stringify(sfuRoom.members) }`);
      console.log(` sfuRoom.remoteStreams: ${ JSON.stringify(sfuRoom.remoteStreams) }`);
      this.addParticipant(peerId);
    });
    sfuRoom.on('stream', (stream) => {
      console.log(`stream: ${stream.peerId}`);
      console.log(` sfuRoom.members: ${ JSON.stringify(sfuRoom.members) }`);
      console.log(` sfuRoom.remoteStreams: ${ JSON.stringify(sfuRoom.remoteStreams) }`);
      this.addVideo(stream);
    });
    sfuRoom.on('removeStream', (stream) => {
      console.log(`removeStream: ${stream.peerId}`);
    });
    sfuRoom.on('peerLeave', (peerId: string) => {
      console.log(`peerLeave: ${peerId}`);
      this.removeParticipant(peerId);
    });
    sfuRoom.on('close', () => {
      this.removeAllRemoteViedos();
      this.setupMakeCallUI();
    });
  }

  addAllParticipants(sfuRoom) {
    console.log(`addAllParticipants:`)
    const members: string[] = sfuRoom.members;
    members.forEach((memberPeerId) => {
      this.videoStreams.push({
        id: memberPeerId
      });
      this.changeDetect.detectChanges();
    });
  }

  addParticipant(peerId: string) {
    console.log(`addParticipant: sfuRoom.members: ${ this.exsistingSfuRoom && this.exsistingSfuRoom.members }`);
    this.videoStreams.push({
      id: peerId
    });
    this.changeDetect.detectChanges();
  }

  addVideo(stream) {
    const inputAudio = this.audioContext.createMediaStreamSource(stream);
    inputAudio.connect(this.mixedAudio);
    const index = this.videoStreams.findIndex((videoStream) => {
      if (videoStream.id === stream.peerId) {
        return true;
      }
      return false;
    });
    if (0 <= index) {
      this.videoStreams[index] = {
        ...this.videoStreams[index],
        ...{ stream, inputAudio }
      };
    } else {
      this.videoStreams.push({
        id: stream.peerId,
        stream,
        inputAudio,
      });
    }
    this.changeDetect.detectChanges();
  }

  removeParticipant(id: string) {
    console.log(`removeParticipant: sfuRoom.members: ${ this.exsistingSfuRoom && this.exsistingSfuRoom.members }`);
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
      this.removeParticipant(id);
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
    this.peer.on('call', (sfuRoom) => {
      sfuRoom.answer(this.localStream);
      this.setupCallEventHandlers(sfuRoom);
    });
    this.peer.on('error', (err) => {
      alert(err.message);
    });
  }

  ngOnDestroy() {
    if (this.peer) {
      this.peer.destroy();
    }
  }

  setupMedia() {
    this.localStream = null;
    if (! this.isReceiveOnly) {
      const constraints = {
        video: ! this.isAudioOnly,
        audio: true
      };
      navigator.mediaDevices.getUserMedia(constraints)
        .then((stream) => {
          this.removeParticipant('localStream');
          this.videoStreams.push({id: 'localStream', stream, inputAudio: null });
          this.localStream = stream;
          if (this.exsistingSfuRoom) {
            this.exsistingSfuRoom.replaceStream(stream);
          }
        }).catch((error) => {
          console.error('mediaDevice.getUserMedia() error:', error);
          return;
        });
    } else {
      this.removeParticipant('localStream');
    }

    navigator.mediaDevices.ondevicechange = (ev: Event) => {
      console.log(`ondevicechange: ${ new EventInfo(ev).toString() }`);
      this.ngZone.run(() => {
        this.events.push(`ondevicechange: ${ new EventInfo(ev).toString() }`);
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

      (async () => {
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
    const mics = [];
    navigator.mediaDevices.enumerateDevices()
      .then((deviceInfos) => {
        console.log(`deviceInfos: ${ deviceInfos.length }`);
        for (let i = 0; i !== deviceInfos.length; ++i) {
          const deviceInfo = deviceInfos[i];
          if (deviceInfo.kind === 'audioinput') {
            console.log(`MIC: label: ${ deviceInfo.label }, id: ${ deviceInfo.deviceId }`);
            console.log(JSON.stringify(deviceInfo.toJSON(), null, 2));
            mics.push(deviceInfo);
          }
        }
        this.mics = mics;
      })
      .catch((error) => {
        console.error('mediaDevice.enumerateDevices() error:', error);
      });
  }
}
