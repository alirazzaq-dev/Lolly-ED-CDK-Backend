import { EventBridgeEvent, Context } from 'aws-lambda';
import { randomBytes } from 'crypto';
import * as AWS from 'aws-sdk';

const dynamoClient = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.DYNAMO_TABLE_NAME as string;


export const handler = async (event: EventBridgeEvent<string, any>, context: Context) => {

    console.log(JSON.stringify(event, null, 2));
    // const returningPayload: PayloadType = { operationSuccessful: true };

    try {
        //////////////  adding new Lolly /////////////////////////
        if (event["detail-type"] === "createLolly") {
            console.log("detail ===>", JSON.stringify(event.detail, null, 2));
            const params = {
                TableName: TABLE_NAME,
                Item: event.detail,
            }
            await dynamoClient.put(params).promise();
        }
    } catch (error) {

        console.log("ERROR ====>", error);

    }

    try {
        //////////////  deleting Lolly /////////////////////////
        if (event["detail-type"] === "deleteLolly") {
            console.log("detail ===>", JSON.stringify(event.detail, null, 2));
            const params = {
                TableName: TABLE_NAME,
                Key: {
                    id: event.detail.id
                }
            }
            await dynamoClient.delete(params).promise();
        }
    } catch (error) {

        console.log("ERROR ====>", error);

    }



     

};