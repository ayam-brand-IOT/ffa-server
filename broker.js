const mosca = require("mosca");
const quotes = require("./services/muestras");
const mqtt = require("mqtt");

const broker = new mosca.Server({
  port: 9000
});

let pub;

broker.on("ready", () => {
  console.log("Mosca broker it's fuckin reada");
  pub = mqtt.connect("mqtt://localhost:9000");
});

broker.on("clientConnected", client => {
  console.log("New Client: " + client.id);
  console.log(quotes.getMultiple(1));
});

broker.on("published", packet => {
  console.log(packet);
  switch (packet.topic) {
    case "read":
      console.warn("Read");
      const { data } = quotes.getByTag(packet.payload.toString());
      if (data.length > 0) pub.publish("classify", data[0].aisle.toString());
      break;

    case "match":
      console.warn("Match");
      const { id, type } = JSON.parse(packet.payload.toString());
      const response = quotes.getType(id).data;
      if (response.length > 0) {
        if (response[0].type == type) {
          const matchRes = quotes.getByTag(id).data;
          pub.publish("classify", matchRes[0].aisle.toString());
        }
      }
      break;

    case "write":
      const jsonData = JSON.parse(packet.payload.toString());
      console.warn(jsonData);
      quotes.changeType(jsonData);
      break;

    case "accomulate":
      // const jsonResponse = JSON.parse(packet.payload.toString());
      // quotes.accomulate(jsonResponse);
      break;
    default:
  }
});
