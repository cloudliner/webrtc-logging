// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  firebase: {
    apiKey: 'AIzaSyAucXzJWfkW_494eNuNgU9Rcav6WzLPlng',
    authDomain: 'webrtc-logging.firebaseapp.com',
    databaseURL: 'https://webrtc-logging.firebaseio.com',
    projectId: 'webrtc-logging',
    storageBucket: 'webrtc-logging.appspot.com',
    messagingSenderId: '726212469363',
    appId: '1:726212469363:web:03f6f779d734107f5e4006',
    measurementId: 'G-XW4RGGT0BY'
  },
  skyway: {
    apiKey: 'd48c7cdf-d481-451c-a38f-0fb443b08731'
  }
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
