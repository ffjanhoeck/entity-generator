const readlineSync = require('readline-sync');
const cliColor = require('cli-color');
const axios = require('axios');
const faker = require('faker');
const fileSystem = require('fs');
const FormData = require('form-data');

const addresses = JSON.parse(fileSystem.readFileSync('addresses.json'));
const API_STAGES = ['development', 'staging', 'production'];
const SCHEMA_NAME = 'house_purchase';

const getAPIBaseUrl = (apiStage) => {
    return `https://api.${apiStage}.cloudios.flowfact-${apiStage === 'development' ? 'dev' : 'prod'}.cloud`;
}

const buildValue = (value) => ({values: [value]});

const getRandomAddress = async () => {
    return addresses[Math.floor(Math.random() * addresses.length)];
}

const createEntity = async (apiStage, cognitoToken) => {
    const entity = {
        purchaseprice: buildValue(faker.random.number({ min: 150000, max: 500000 })),
        internaldescription: buildValue(faker.commerce.productDescription()),
        livingarea: buildValue(faker.random.number({ min: 70, max: 220 })),
        rooms: buildValue(faker.random.number({ min: 2, max: 5 })),
        status: buildValue('active'),
        addresses: buildValue(await getRandomAddress())
    }

    const response = await axios.post(`${getAPIBaseUrl(apiStage)}/entity-service/schemas/${SCHEMA_NAME}`, entity, {
        headers: {
            cognitoToken: cognitoToken
        }
    });
    if(response.status === 200) {
        return response.data;
    }
}

const uploadEntityImage = async (entityId, apiStage, cognitoToken) => {
    const imageUrl = faker.image.city();
    const image = (await axios.get(imageUrl)).data;

    const formData = new FormData();
    formData.append('file', image);

    const uploadResponse = await axios.post(`${getAPIBaseUrl(apiStage)}/multimedia-service/items/schemas/${SCHEMA_NAME}/entities/${entityId}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
            cognitoToken: cognitoToken
        }
    });

    if(uploadResponse.status === 201) {
        const { multimediaItem: { id }} = uploadResponse.data;
        await axios.put(`${getAPIBaseUrl(apiStage)}/multimedia-service/assigned/schemas/${SCHEMA_NAME}/entities/${entityId}?albumName=flowfact_client&short=true`, {
            assignments: {
                main_image: [{ multimedia: id, sorting: 0}]
            }
        });
    }
}

const main = async () => {
    // Get the amount of estates
    const estateAmount = readlineSync.question(cliColor.green('How many estates do you want to generate?'));
    if (isNaN(estateAmount)) {
        console.warn(cliColor.red(`The amount has to be a number! You input was ${estateAmount}`));
        return;
    }

    // Get the api stage
    const apiStageIndex = readlineSync.keyInSelect(API_STAGES, 'Against which environment do you want to speak?');
    if (typeof apiStageIndex === 'undefined') {
        return;
    }
    const apiStage = API_STAGES[apiStageIndex];

    // Get the cognito token, to send call against the platform
    const cognitoToken = readlineSync.question(`Please tell me your cognito token for ${apiStage}`);

    for (let index = 0; index < Number(estateAmount); index++) {
        console.log(`${index + 1}/${Number(estateAmount)}`);
        try {
            const entityId = await createEntity(apiStage, cognitoToken);
            //await uploadEntityImage(entityId, apiStage, cognitoToken);
        } catch(error) {
            console.error(error);
        }
    }
}

main();
