//----//

const h2b = (h) => {
  return Uint8Array.from(h.match(/.{1,2}/g).map((b)=>parseInt(b,16)));
}
const b2h = (b) => {
  return b.reduce((str,byte)=>str+byte.toString(16).padStart(2,"0"),"");
}

const b642h = (b64) => {
  const w = atob(b64);
  let r = "";
  for (let i=0;i<w.length;i++) {
    const h = w.charCodeAt(i).toString(16);
    r += (h.length===2?h:"0"+h);
  }
  return r;
}

const date2str = (n) => {
  return new Date(n*1000).toLocaleString();
}

const date2strt = (n) => {
  return new Date(n*1000).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

const date2str3 = (n) => {
  const t = new Date(n*1000);
  return `${t.getFullYear()}/${t.getMonth()+1}/${t.getDate()}`;
}

const sign = async (event,sk) => {
  const { schnorr } = nobleSecp256k1;
  const sha256 = bitcoinjs.crypto.sha256;
  const data = JSON.stringify([
    0,
    event["pubkey"],
    event["created_at"],
    event["kind"],
    event["tags"],
    event["content"]
  ]);
  event.id = sha256(data).toString("hex");
  event.sig = await schnorr.sign(event.id,sk);
  return event;
}
const encrypt2 = (sk,pk,text) => {
  const key = nobleSecp256k1.getSharedSecret(sk,"02"+pk,true).substring(2);
  const iv = window.crypto.getRandomValues(new Uint8Array(16));
  const cipher = browserifyCipher.createCipheriv(
    "aes-256-cbc", 
    h2b(key), 
    iv
  );
  const emsg = cipher.update(text,"utf8","base64")+cipher.final("base64");
  return emsg+"?iv="+btoa(String.fromCharCode.apply(null,new Uint8Array(iv.buffer)));
}
const decrypt2 = (sk,pk,text) => {
  const [emsg, iv] = text.split("?iv=");
  const key = nobleSecp256k1.getSharedSecret(sk,"02"+pk,true).substring(2);
  const decipher = browserifyCipher.createDecipheriv(
    "aes-256-cbc",
    h2b(key),
    h2b(b642h(iv))
  );
  return decipher.update(emsg,"base64")+decipher.final("utf8");
}
const encrypt = (sk,pk,text) => {
  const key = nobleSecp256k1.getSharedSecret(sk,"02"+pk,true).substring(2);
  const iv = window.crypto.getRandomValues(new Uint8Array(16));
  const cipher = browserifyCipher.createCipheriv("aes-256-cbc",h2b(key), iv);
  const encoder = new TextEncoder();
  const encodedText = encoder.encode(text);
  const emsg = buffer.Buffer.concat([cipher.update(encodedText),cipher.final()]).toString('base64');
  return emsg + "?iv="+btoa(String.fromCharCode.apply(null,iv));
}
const decrypt = (sk,pk,text) => {
  const [emsg,iv] = text.split("?iv=");
  const key = nobleSecp256k1.getSharedSecret(sk,"02"+pk,true).substring(2);
  const decipher = browserifyCipher.createDecipheriv("aes-256-cbc",h2b(key),h2b(b642h(iv)));
  const decrypted = buffer.Buffer.concat([decipher.update(buffer.Buffer.from(emsg,"base64")),decipher.final()]);
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

const getPublicFromTags = (tags) => {
  for (let i=0;i<tags.length;i++) {
    if (tags[i][0]==="p") {
      return tags[i][1];
    }
  }
  return "";
}

//----//

window.resize = () => {
  const root = document.querySelector(":root");
  const width = window.innerWidth;
  const height = window.innerHeight;
  root.style.setProperty("--vw",width+"px");
  root.style.setProperty("--vh",height+"px");
  root.style.setProperty("--vmin",(width<height?width:height)+"px");
  root.style.setProperty("--vmax",(width>height?width:height)+"px");
}
window.resize();
window.addEventListener("resize",window.resize);

const fallback_copy_text = (text) => {
  var textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.focus();
  textArea.select();

  try {
    document.execCommand("copy");
  } catch(err) {}
}
const copy_text = (text) => {
  if (!navigator.clipboard) {
    fallback_copy_text(text);
    return;
  }
  navigator.clipboard.writeText(text)//.then(()=>{},(err)=>{});
}

const set_tab = (n) => {
  if (n!=3) {
    if (current_id!="") close(current_id);
    current_chat = "";
    current_id = "";
    current_chat_page = 0;
  }
  const tabs = document.querySelectorAll(".view .tab");
  const btns = document.querySelectorAll(".bar .content div");
  for (let i=0;i<4;i++) {
    if (i==n) {
      tabs[i].classList.add("active");
      if (i<3) btns[i].classList.add("active");
    } else {
      tabs[i].classList.remove("active");
      if (i<3) btns[i].classList.remove("active");
    }
  }
}

message_input.addEventListener("input",() => {
  message_footer.style.height = "0";
  message_footer.style.height = message_input.scrollHeight*1.75 - 8 + "px";
});
message_footer.style.height = "0";
message_footer.style.height = message_input.scrollHeight*1.75 - 8 + "px";

send_message.onclick = () => {
  if (message_input.value.trim().length>0) {
    send_msg(current_chat,message_input.value.trim());
    message_input.value = "";
    messages_div.scrollTop = messages_div.scrollHeight;
    message_footer.style.height = "0";
    message_footer.style.height = message_input.scrollHeight*1.75 - 8 + "px";
  }
}

//----//

const user = JSON.parse(localStorage.getItem("Nxstr.user"))||{};
if (!user.contacts) {
  user.contacts = [];
}
const kind0s = {};
const last4s = {};
let messages = [];
let socket;
let current_chat = "";
let current_id = "";
let current_chat_page = 0;
connected = false;

const load_elements_fix = () => {
  input_pk_h.removeAttribute("hidden");
  input_pk.style.display = "flex";
  load_key.style.display = "none";
  make_key.style.display = "none";
  localStorage.setItem("Nxstr.user",JSON.stringify(user));
  document.querySelector(".pk_info").style.display = "block";
}

const disload_elements_fix = () => {
  user.sk = input_sk.value = "";
  user.pk = input_pk_value.innerText = "";
  input_pk_h.setAttribute("hidden","");
  input_pk.style.display = "none";
  load_key.style.display = "block";
  make_key.style.display = "block";
  localStorage.setItem("Nxstr.user",JSON.stringify(user));
  document.querySelector(".pk_info").style.display = "none";
  profile_settings.style.display = "none";
}

input_sk.addEventListener("focus",() => {
  input_sk.type = "text";
});

input_sk.addEventListener("blur",() => {
  input_sk.type = "password";
});

load_key.onclick = () => {
  if (input_sk.value.trim().length<1) {
    alert("Input secret key first!");
    return;
  }
  try {
    const keypair = bitcoinjs.ECPair.fromPrivateKey(buffer.Buffer.from(input_sk.value,"hex"));
    user.sk = input_sk.value;
    user.pk = input_pk_value.innerText = keypair.publicKey.toString("hex").substring(2);
    load_elements_fix();
  } catch(err) {}
}

make_key.onclick = () => {
  try {
    const keypair = bitcoinjs.ECPair.makeRandom();
    user.sk = input_sk.value = keypair.privateKey.toString("hex");
    user.pk = input_pk_value.innerText = keypair.publicKey.toString("hex").substring(2);
    load_elements_fix();
  } catch(err) { document.body.innerHTML = err }
}

btn_logout.onclick = () => {
  if (confirm("Are you sure you want to log out?")) {
    disload_elements_fix();
  }
}

copy_pk.onclick = () => {
  copy_text(user.pk);
}

function get_times(n) {
  const t = new Date();
  const t1 = new Date(t);
  t1.setHours(0,0,0,0);
  t1.setDate(t.getDate()-n);
  const t2 = new Date(t);
  t2.setHours(0,0,0,0);
  t2.setDate(t.getDate()-n-1);
  return [t1.getTime()/1000,t2.getTime()/1000];
}

const contacts_update = () => {
  if (user.contacts) {
    contact_list.innerHTML = "";
    for (i in user.contacts) {
      const contact = document.createElement("div");
      contact.classList.add("contact");
      const picture_div = document.createElement("div");
      const picture_img = document.createElement("img");
      picture_img.src = "./svg/face.png";
      picture_div.classList.add("picture");
      picture_div.appendChild(picture_img);

      const content_div = document.createElement("div");
      content_div.classList.add("content");
      content_div.setAttribute("onclick",`load_chat("${user.contacts[i]}")`);
      const name = document.createElement("div");
      name.innerText = user.contacts[i];
      name.classList.add("name");
      content_div.appendChild(name);
      const message = document.createElement("div");
      message.classList.add("message");
      content_div.appendChild(message);

      if (kind0s[user.contacts[i]]) {
        const data = JSON.parse(kind0s[user.contacts[i]]);
        name.innerText = data.name||user.contacts[i];
        picture_img.src = data.picture||"./svg/face.png";
      }

      if (last4s[user.contacts[i]]) {
        message.innerText = last4s[user.contacts[i]][0];
      }

      const delete_div = document.createElement("div");
      const delete_img = document.createElement("img");
      delete_img.setAttribute("draggable","false");
      delete_img.src = "./svg/close.svg";
      delete_div.classList.add("delete");
      delete_div.setAttribute("onclick",`delete_contact("${user.contacts[i]}")`);
      delete_div.appendChild(delete_img);

      contact.appendChild(picture_div);
      contact.appendChild(content_div);
      contact.appendChild(delete_div);
      contact_list.appendChild(contact);
      contact_list.appendChild(document.createElement("br"));
    }
  }
}

const delete_contact = (pk) => {
  if (confirm("Are you sure you want to delete this?")) {
    let i = user.contacts.indexOf(pk);
    if (i!==-1) {
      user.contacts.splice(i,1);
    }
    localStorage.setItem("Nxstr.user",JSON.stringify(user));
    contacts_update();
  }
}

contact_add.onclick = () => {
  if (contact_input.value.trim().length<1) {
    return;
  }
  try {
    bitcoinjs.ECPair.fromPublicKey(buffer.Buffer.from("02"+contact_input.value,"hex"));
    if (!user.contacts) {
      user.contacts = [contact_input.value];
      localStorage.setItem("Nxstr.user",JSON.stringify(user));
      const id = reqk0(contact_input.value);
      close(id);
      contacts_update();
    } else {
      if (!user.contacts.includes(contact_input.value)) {
        user.contacts.push(contact_input.value);
        localStorage.setItem("Nxstr.user",JSON.stringify(user));
        const id = reqk0(contact_input.value);
        close(id);
        contacts_update();
      }/* else {
        "already in the list"
      }*/
    }
  } catch(err) {}
}

const close = (id) => {
  if (!socket) return;
  socket.send(JSON.stringify(["CLOSE",id]));
}

const reqk0 = (pk) => {
  if (!socket) return;
  const filter = { "authors":[pk],"kinds":[0] };
  socket.send(JSON.stringify(["REQ","k0",filter]));
  close("k0");
}

const setk0 = async (name="",about="",picture="") => {
  if (!socket) return;
  const event = {
    "content": `{"name":"${name}","about":"${about}","picture":"${picture}"}`,
    "created_at": Math.floor(Date.now()/1000),
    "kind": 0,
    "tags": [],
    "pubkey": user.pk
  };
  const signed = await sign(event,user.sk);
  socket.send(JSON.stringify(["EVENT",signed]));
}

const req_chat = (pk,n) => {
  if (!socket) return;
  const id = bitcoinjs.ECPair.makeRandom().privateKey.toString("hex");
  let filter = { "authors":[pk],"kinds":[4],"#p":[user.pk] };
  let filter2 = { "authors":[user.pk],"kinds":[4],"#p":[pk] };
  const t = get_times(n-1);
  if (n==0) {
    filter["since"] = t[1];
  } else {
    filter["until"] = t[0];
    filter["since"] = t[1];
  }
  if (n==0) {
    filter2["since"] = t[1];
  } else {
    filter2["until"] = t[0];
    filter2["since"] = t[1];
  }
  socket.send(JSON.stringify(["REQ",id,filter,filter2]));
  return id;
}

const get_last_msg = (pk) => {
  if (!socket) return;
  const filter = { "authors":[user.pk],"kinds":[4],"limit":1,"#p":[pk] };
  socket.send(JSON.stringify(["REQ","last",filter]));
  close("last");
}
const get_last_msgs = () => {
  if (!socket) return;
  const filter = { "kinds":[4],"#p":[user.pk],"since":get_times(7)[1] };
  socket.send(JSON.stringify(["REQ","last",filter]));
  close("last")
}
const get_new_msgs = () => {
  if (!socket) return;
  const filter1 = { "kinds":[4],"#p":[user.pk],"limit":0 };
  const filter2 = { "authors":[user.pk],"kinds":[4],"limit":0 };
  socket.send(JSON.stringify(["REQ","new",filter1,filter2]));
}

const send_msg = async (pk,text) => {
  const encrypted = encrypt(user.sk,pk,text);
  const event = {
    "content": encrypted,
    "created_at": Math.floor(Date.now()/1000),
    "kind": 4,
    "tags": [["p",pk]],
    "pubkey": user.pk
  };
  const signed = await sign(event,user.sk);
  socket.send(JSON.stringify(["EVENT",signed]));
}

const load_messages = () => {
  messages = messages.sort((a,b)=>(a.date>b.date)?1:-1);
  messages_div.innerHTML = "";

  const page_start = document.createElement("div");
  page_start.classList.add("page");
  page_start.setAttribute("onclick",`load_chat("${current_chat}",${current_chat_page+1})`);
  page_start.innerText = "Previous Day";
  messages_div.appendChild(page_start);

  for (let i=0;i<messages.length;i++) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message");
    if (messages[i].pubkey == user.pk) {
      messageDiv.classList.add("right");
    } else {
      messageDiv.classList.add("left");
    }
    var userDiv = document.createElement("div");
    userDiv.classList.add("name");
    userDiv.innerText = (messages[i].pubkey==user.pk?"You":messages[i].pubkey);
    if (kind0s[user.contacts[messages[i].pubkey]]) {
      const data = JSON.parse(kind0s[messages[i].pubkey]);
      userDiv.innerText = data.name||(messages[i].pubkey==user.pk?"You":messages[i].pubkey);
    }
    messageDiv.appendChild(userDiv);
    const textDiv = document.createElement("div");
    textDiv.classList.add("text");
    textDiv.innerText = messages[i].content;
    messageDiv.appendChild(textDiv);
    messages_div.appendChild(messageDiv);
  }
  if (current_chat_page!=0) {
    const page_end = document.createElement("div");
    page_end.classList.add("page");
    page_end.setAttribute("onclick",`load_chat("${current_chat}",${current_chat_page-1})`);
    page_end.innerText = "Next Day";
    messages_div.appendChild(page_end);
  }
}

const load_chat = (pk,n=0) => {
  if (current_id!="") close(current_id);
  messages = [];
  messages_div.innerHTML = "";
  
  set_tab(3);
  current_chat = pk;
  current_chat_page = n;
  current_id = req_chat(pk,n);

  const page_start = document.createElement("div");
  page_start.classList.add("page");
  page_start.setAttribute("onclick",`load_chat("${current_chat}",${current_chat_page+1})`);
  page_start.innerText = "Previous Day";
  messages_div.appendChild(page_start);
  
  const page_mid = document.createElement("div");
  page_mid.classList.add("big_info");
  page_mid.innerText = `No Messages at ${date2str3(get_times(current_chat_page)[0])} :(`;
  messages_div.appendChild(page_mid);

  if (current_chat_page!=0) {
    const page_end = document.createElement("div");
    page_end.classList.add("page");
    page_end.setAttribute("onclick",`load_chat("${current_chat}",${current_chat_page-1})`);
    page_end.innerText = "Next Day";
    messages_div.appendChild(page_end);
  }
}

exit_chat.onclick = () => {
  set_tab(1);
}

update_k0.onclick = () => {
  setk0(input_name.value.trim(),input_about.value.trim(),input_picture.value.trim());
}

const connect = () => {
  if (socket) socket.close();
  socket = new WebSocket("wss://nos.lol");

  socket.addEventListener("message", async (message) => {
    const [type,sub,event] = JSON.parse(message.data);
    if (!event) return;
    let { kind, content , tags , pubkey , created_at , id } = event || {};

           if (kind == 0) {

      kind0s[pubkey] = content;
      if (pubkey==user.pk) {
        const data = JSON.parse(content);
        input_name.value = data.name;
        input_about.value = data.about;
        input_picture.value = data.picture;
        profile_settings.style.display = "block";
      }
      contacts_update();

    } else if (kind == 1) {



    } else if (kind == 4) {

      if (pubkey==user.pk) {
        content = await decrypt(user.sk,getPublicFromTags(tags),content);
        if (!user.contacts.includes(getPublicFromTags(tags))) {
          user.contacts.push(getPublicFromTags(tags));
          contacts_update();
        }
      } else if (getPublicFromTags(tags)==user.pk) {
        content = await decrypt(user.sk,pubkey,content);
        if (!user.contacts.includes(pubkey)) {
          user.contacts.push(pubkey);
          contacts_update();
        }
      }
      if (sub=="last"||sub=="new") {
        if  (pubkey==user.pk) {
          if (!last4s[getPublicFromTags(tags)]||created_at>last4s[last4s[getPublicFromTags(tags)]][1]) {
            last4s[getPublicFromTags(tags)] = [(getPublicFromTags(tags)==user.pk?"":"You: ")+content,created_at];
            contacts_update();
          }
        } else {
          if (!last4s[pubkey]||created_at>last4s[pubkey][1]) {
            last4s[pubkey] = [content,created_at];
            contacts_update();
          }
        }
      } else {
        messages.push({
          "content": content,
          "date": created_at,
          "pubkey": pubkey
        });
        load_messages();
        if (pubkey==user.pk) messages_div.scrollTop = messages_div.scrollHeight;
      }

    }
  });

  socket.addEventListener("close", async (e) => {
    connected = false;
    console.log("Disconnected.");
    document.body.innerHTML = "Disconnected.";
  });

  socket.addEventListener("open", async (e) => {
    connected = true;
    console.log("Connected.");
    if (!user.contacts[user.pk]) {
      reqk0(user.pk);
    }
    for (let i=0;i<user.contacts.length;i++) {
      reqk0(user.contacts[i]);
      get_last_msg(user.contacts[i]);
    }
    get_last_msgs();
    get_new_msgs();
  });
}

if (user!={}) {
  connect();
  contacts_update();
  try {
    const keypair = bitcoinjs.ECPair.fromPrivateKey(buffer.Buffer.from(user.sk,"hex"));
    input_sk.value = user.sk;
    input_pk_value.innerText = keypair.publicKey.toString("hex").substring(2);
    load_elements_fix();
  } catch(err) {}
}
set_tab(1);
