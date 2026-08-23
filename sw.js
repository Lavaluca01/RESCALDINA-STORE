importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyD8vzrP5O3aPa1DetSzmWYMWDjV-VpdgHc",
  authDomain: "gestione-personale-rescaldina.firebaseapp.com",
  projectId: "gestione-personale-rescaldina",
  storageBucket: "gestione-personale-rescaldina.firebasestorage.app",
  messagingSenderId: "144918771825",
  appId: "1:144918771825:web:31145a82da3ea2144743d0"
});

const messaging = firebase.messaging();

const CACHE='preference-rescaldina-firebase-v5';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.json','./logo-mediaworld.jpg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))])));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();if(new URL(e.request.url).origin===self.location.origin)caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)))});
