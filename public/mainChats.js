function postServer(data) {
    return new Promise((resout) => {
        return fetch("/", {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json'
            }
        }).then(res => res.json())
            .then(resout)
            .catch(error => console.error('Error:', error));
    });
}

function getAllSecretChat() {
    let all = getCookie("SecretChat");
    if (all == "") {
        all = [];
    }
    else {
        all = JSON.parse(all);
    }
    return all;
}

async function getAllExitsSecretChat(addnum = true) {
    const all = getAllSecretChat();

    const exit = [];

    for (i of all) {
        const e = await postServer({ do: "exits", id: i.id });
        if (e.exits == true) {
            if (addnum) {
                i.numUsers = e.numUsers;
            }
            exit.push(i);
        }
    }
    return exit;
}

async function addSecretChat(name, id) {
    let all = await getAllExitsSecretChat(false);

    all.unshift({ name: name, id: id, created: Date.now() });

    setCookie("SecretChat", JSON.stringify(all))
}

window.addEventListener("DOMContentLoaded", () => {
    const v = new Vue({
        el: "#allChat",
        data: {
            SecretChat: [],
            chats: [],
            date(i) {
                return (new Date(i).toLocaleString());
            },
            create: async () => {
                const chat = prompt("Chat Name:", "New Chat");
                const public = prompt("This is a public chat? (yes / no)", "yes")
                if (chat != null && public != null) {
                    const type = public.toLowerCase() == "no" ? false : true;
                    const n = (await postServer({ do: "createChat", name: chat, public: type })).code;
                    if (!type) {
                        await addSecretChat(chat, n);
                        await reloadSecret();
                    }
                    else {
                        reload();
                    }
                    v.gotochat(n);
                }
            },

            gotochat(i) {
                window.open("/chat.html#" + i, "_block");
            },

            async deleteChat(i, name, type) {

                const ok = confirm("Delete this chat -> " + name + "?");

                if (!ok)
                    return;

                const del = await postServer({ do: "deleteChat", id: i });

                if (del == true) {
                    if (type == 's')
                        reloadSecret();
                    else
                        reload();
                }
                else {
                    alert("This chat is public and not empty - it can't be deleted!");
                }
            }
        },
        async mounted() {
            setInterval(() => { reload(v); reloadSecret(v); }, 1000 * 10);
            reload(this);
            reloadSecret(this)
        }
    });

    async function reloadSecret(b = v) {
        b.SecretChat = await getAllExitsSecretChat();
    }

    async function reload(b = v) {
        b.chats = (Object.values(await postServer({ do: "getopenchats" }))).reverse();
    }
})