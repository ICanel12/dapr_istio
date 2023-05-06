//
// Copyright 2021 The Dapr Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//     http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

const express = require('express');
const bodyParser = require('body-parser');
require('isomorphic-fetch');

const app = express();
app.use(bodyParser.json());
const candidatos = [];
const votantesQueHanVotado = [];
let votos = [];

// These ports are injected automatically into the container.
const daprPort = process.env.DAPR_HTTP_PORT ?? "3500"; 
const daprGRPCPort = process.env.DAPR_GRPC_PORT ?? "50001";

const stateStoreName = `statestore`;
const stateUrl = `http://localhost:${daprPort}/v1.0/state/${stateStoreName}`;
const port = process.env.APP_PORT ?? "3000";


    let faseCandidatos = false;
    let faseVotacion = false;
  let seCerroFase = false;

app.get('/order', async (_req, res) => {
    try {
        const response = await fetch(`${stateUrl}/order`);
        if (!response.ok) {
            throw "Could not get state.";
        }
        const orders = await response.text();
        res.send(orders);
    }
    catch (error) {
        console.log(error);
        res.status(500).send({message: error});
    }
});

app.post('/neworder', async (req, res) => {
    const data = req.body.data;
    const orderId = data.orderId;
    console.log("Got a new order! Order ID: " + orderId);

    const state = [{
        key: "order",
        value: data
    }];

    try {
        const response = await fetch(stateUrl, {
            method: "POST",
            body: JSON.stringify(state),
            headers: {
                "Content-Type": "application/json"
            }
        });
        if (!response.ok) {
            throw "Failed to persist state.";
        }
        console.log("Successfully persisted state for Order ID: " + orderId);
        res.status(200).send();
    } catch (error) {
        console.log(error);
        res.status(500).send({message: error});
    }
});

app.get('/ports', (_req, res) => {
    console.log("DAPR_HTTP_PORT: " + daprPort);
    console.log("DAPR_GRPC_PORT: " + daprGRPCPort);
    res.status(200).send({DAPR_HTTP_PORT: daprPort, DAPR_GRPC_PORT: daprGRPCPort })
});

app.listen(port, () => console.log(`Node App está escuchando en el puerto ${port}!`));



//PASO 1

app.post('/AbrirFaseCandidatos', (req, res) => {
    faseCandidatos = true; 
  res.status(200).send('Se ha abierto la fase para crear candidatos');
});


app.post('/candidatos', (req, res) => {

    if (!faseCandidatos) {
        res.status(400).send('Se ha cerrado la parte de agregar candidato');
        return;
      }

      if (faseCandidatos) {
        const { nombre, apellido, correo, telefono, posicion } = req.body
        const nuevoCandidato = crearCandidato(nombre, apellido, correo, telefono, posicion)
      
        // Enviar una respuesta con el nuevo registro creado
        res.status(201).json('Se ha creado un nuevo candidato');
      }else{
        res.status(400).send('No se ha abierto la fase para ingresar candidatos');
      }
  })



//PASO 2

app.post('/AbrirFaseVotacion', (req, res) => {
    faseVotacion = true; // Asignar el valor false a la variable global
  res.status(200).send('Se ha abierto la fase de votación');
});

app.post('/CerrarFase', (req, res) => {
    faseCandidatos = false; // Asignar el valor false a la variable global
  res.status(200).send('Se ha cerrado la fase para crear candidatos');
});


//PASO 3
app.post('/votar', (req, res) => {
    const { id_votante, nombre_candidato, es_nulo } = req.body;
  
    if(faseVotacion){
        if (!faseCandidatos) {
            if (seCerroFase) {
                res.status(400).send('Se ha cerrado las votaciones');
                return;
            }else{
            // Verificar si el votante ya ha votado anteriormente
            if (yaHaVotado(id_votante)) {
                res.status(400).send('Intento de fraude');
                return;
              }
            
              // Registrar el voto en la base de datos
              registrarVoto(id_votante, nombre_candidato, es_nulo);
            
              res.status(200).send('Voto registrado correctamente');
            }
          }else{
    
            res.status(400).send('Se debe cerrar la fase de candidatos');
          }
    }else{
        res.status(400).send('Se debe abrir fase de votación');
    }

  });


  //PASO 4
  app.post('/cerrarfasevotacion', (req, res) => {
    seCerroFase = true; 
  res.status(200).send('Se ha cerrado la fase de votación');
});


  function crearCandidato(nombre, apellido, correo, telefono, posicion) {
    // Crear un objeto con los datos del candidato
    const nuevoCandidato = {
      nombre,
      apellido,
      correo,
      telefono,
      posicion
    }
  
    // Agregar el nuevo candidato a la variable global de candidatos
    candidatos.push(nuevoCandidato)
  
    console.log("Candidato Creado")
  }
  

  function registrarVoto(id_votante, nombre_candidato, es_nulo) {
    let fecha = new Date().toISOString()

    let voto = {
      id_votante,
      nombre_candidato,
      es_nulo,
      fecha
    }
    
    votos.push(voto)
  }


  function yaHaVotado(id_votante) {
    return votos.find(voto => voto.id_votante === id_votante) !== undefined;
  }

  //Estadística

  app.get('/conteo-votos', (req, res) => {
    let conteoVotosPorCandidato = votos.reduce(function (acumulador, voto) {
      let candidato = voto.nombre_candidato;
      if (!acumulador[candidato]) {
        acumulador[candidato] = 0;
      }
      acumulador[candidato]++;
      return acumulador;
    }, {});
    res.json(conteoVotosPorCandidato);
  });
  


