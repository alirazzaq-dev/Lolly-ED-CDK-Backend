import * as cdk from '@aws-cdk/core';
import * as lambda from "@aws-cdk/aws-lambda";
import * as events from "@aws-cdk/aws-events";
import * as appsync from "@aws-cdk/aws-appsync";
import * as targets from "@aws-cdk/aws-events-targets";
import * as dynamodb from '@aws-cdk/aws-dynamodb';

import { requestTemplate, responseTemplate, EVENT_SOURCE } from '../utils/appsync-request-response';


export class LollyEdCdkBackendStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

 // API
 const api = new appsync.GraphqlApi(this, "Api", {
  name: "LollyEventbridgeAPI",
  schema: appsync.Schema.fromAsset("utils/schema.gql"),
  authorizationConfig: {
    defaultAuthorization: {
      authorizationType: appsync.AuthorizationType.API_KEY,
      apiKeyConfig: {
        expires: cdk.Expiration.after(cdk.Duration.days(365)),
      },
    },
  },
  logConfig: { fieldLogLevel: appsync.FieldLogLevel.ALL },
  xrayEnabled: true,
});

// Create new DynamoDB Table for Todos
const LollyTable = new dynamodb.Table(this, 'TodoTable', {
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  partitionKey: {
    name: 'id',
    type: dynamodb.AttributeType.STRING,
  },
});

   /////////////////  APPSYNC data source /////////////////////////////

    // DynamoDB as a Datasource for the Graphql API.
    const LollyTableDS = api.addDynamoDbDataSource('TodoDynamoTable', LollyTable);

    // HTTP DATASOURCE
    const httpDs = api.addHttpDataSource(
      "ds",
      "https://events." + this.region + ".amazonaws.com/", // This is the ENDPOINT for eventbridge.
      {
        name: "httpDsWithEventBridge",
        description: "From Appsync to Eventbridge",
        authorizationConfig: {
          signingRegion: this.region,
          signingServiceName: "events",
        },
      }
    );

    events.EventBus.grantAllPutEvents(httpDs);
    
    
        ///////////////  APPSYNC  Resolvers   ///////////////
    /* Query */
    LollyTableDS.createResolver({
      typeName: "Query",
      fieldName: "getLollies",
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbScanTable(),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultList(),
    });

    LollyTableDS.createResolver({
      typeName: "Query",
      fieldName: "getLollybyID",
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbGetItem('id', 'id'),   ///Mapping template to delete a single item from a DynamoDB table.
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem()             ////Mapping template for a single result item from DynamoDB.
    });

    /* Mutation */
 
    const mutations = ["createLolly", 'deleteLolly']

    mutations.forEach((detailType) => {

      let details = "something"

      if(detailType === 'createLolly'){
       details = `\\\"id\\\":\\\"$ctx.args.lolly.id\\\", \\\"recipient\\\":\\\"$ctx.args.lolly.recipient\\\", \\\"message\\\":\\\"$ctx.args.lolly.message\\\", \\\"sender\\\":\\\"$ctx.args.lolly.sender\\\", \\\"c1\\\":\\\"$ctx.args.lolly.c1\\\", \\\"c2\\\":\\\"$ctx.args.lolly.c2\\\", \\\"c3\\\":\\\"$ctx.args.lolly.c3\\\", \\\"link\\\":\\\"$ctx.args.lolly.link\\\"`
      }

      else if(detailType === 'deleteLolly') {
        details = `\\\"id\\\":\\\"$ctx.args.id\\\"`
      } 

      httpDs.createResolver({
        typeName: "Mutation",
        fieldName: detailType,
        requestMappingTemplate: appsync.MappingTemplate.fromString(requestTemplate(details, detailType)),
        responseMappingTemplate: appsync.MappingTemplate.fromString(responseTemplate()),
      });
    });




     ////////////////////////////// Creating Lambda handler ////////////////////////
    /* lambda 1 */
    const dynamoHandlerLambda = new lambda.Function(this, 'Dynamo_Handler', {
      code: lambda.Code.fromAsset('lambda'),
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'dynamoHandler.handler',
      environment: {
        DYNAMO_TABLE_NAME: LollyTable.tableName,
      },
      timeout: cdk.Duration.seconds(10)
    });
    // Giving Table access to dynamoHandlerLambda
    LollyTable.grantReadWriteData(dynamoHandlerLambda);


    ////////// Creating rule to invoke step function on event ///////////////////////
    new events.Rule(this, "eventConsumerRule", {
      eventPattern: {
        source: [EVENT_SOURCE],
        detailType: [...mutations],
      },
      targets: [new targets.LambdaFunction(dynamoHandlerLambda)]
    });


    // Log GraphQL API Endpoint
    new cdk.CfnOutput(this, 'Graphql_Endpoint', {
      value: api.graphqlUrl
    });

  }
}



import * as cloudfront from "@aws-cdk/aws-cloudfront";
import * as origins from "@aws-cdk/aws-cloudfront-origins";
import * as s3 from "@aws-cdk/aws-s3";
import * as s3Deployment from "@aws-cdk/aws-s3-deployment";


export class LollyEdCdkFrontendStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    // create a bucket to upload your app files

    const myBucket = new s3.Bucket(this, "GATSBYbuckets", {
      versioned: true,       
      websiteIndexDocument: "index.html"
    });

    const dist = new cloudfront.Distribution(this, 'myDistribution', {
      defaultBehavior: { origin: new origins.S3Origin(myBucket) }
    });

    new s3Deployment.BucketDeployment(this, "deployStaticWebsite", {
      sources: [s3Deployment.Source.asset("../Lolly-ED-CDK-Frontend/public")],
      destinationBucket: myBucket,
      distribution: dist
    });

    new cdk.CfnOutput(this, "DistributionDomainName", {
      value: dist.domainName,
    });

  }
}
