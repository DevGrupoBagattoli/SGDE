import webpush from "web-push"

const { publicKey, privateKey } = webpush.generateVAPIDKeys()

console.log("Chaves VAPID geradas. Copie as linhas abaixo para o seu .env:")
console.log("")
console.log(`VAPID_PUBLIC_KEY="${publicKey}"`)
console.log(`VAPID_PRIVATE_KEY="${privateKey}"`)
console.log("")
console.log(
  "Atenção: trocar as chaves invalida TODAS as subscriptions existentes " +
    "(assinadas com a chave antiga). Nesse caso, limpe a tabela PushSubscription " +
    "e peça reativação aos usuários."
)
