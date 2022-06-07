import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import "bootstrap/dist/css/bootstrap.min.css";
import './index.css';
import reportWebVitals from './reportWebVitals';
import Files from "react-butterfiles";
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  gql
} from "@apollo/client";

const client = new ApolloClient({
  uri: 'http://localhost:4000',
  cache: new InMemoryCache({addTypename: false})
});

const PRESIGNED_UPLOAD_POST = gql`
      query presignedUploadPost($filename: String!, $filetype: String!) {
        presignedUploadPost(filename: $filename, filetype: $filetype) {
          url
          fields {
            ContentType
            key
            bucket
            XAmzAlgorithm
            XAmzDate
            XAmzCredential
            Policy
            XAmzSignature
          }
        }
      }
    `;

const GET_SIGNED_URL = gql`
      query getSignedUrl($filename: String!) {
        getSignedUrl(filename: $filename)
        }
`;

const DELETE_OBJECT = gql`
      mutation deleteObject($filename: String!) {
        deleteObject(filename: $filename)
      }
`;

const hyphenatedKeys = {
  ContentType: 'Content-Type',
  XAmzAlgorithm: 'X-Amz-Algorithm',
  XAmzDate: 'X-Amz-Date',
  XAmzCredential: 'X-Amz-Credential',
  XAmzSignature: 'X-Amz-Signature'
}

const getPresignedPostData = selectedFile => {
  return client.query({
    query: PRESIGNED_UPLOAD_POST,
    variables: { filename: selectedFile.name, filetype: selectedFile.type },
    fetchPolicy: 'no-cache'
  });
};

const getSignedUrl = filename => {
  return client.query({
    query: GET_SIGNED_URL,
    variables: { filename: filename },
    fetchPolicy: 'no-cache'
  });
};


const deleteObject = filename => {
  return client.mutate({
    mutation: DELETE_OBJECT,
    variables: { filename: filename }
  });
};

const DeleteButton = ({filename}) => {
  const [loading, setLoading] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const deleteFile = async () => {
    setLoading(true);
    setIsDeleted(false);
    await deleteObject(filename);
    setLoading(false);
    setIsDeleted(true);
  };


    if(isDeleted) return "Deleted!";
    else if(loading) return "Deleting...";
    else return <button type="button" className="btn btn-link" onClick={deleteFile}>Delete</button>;
}

const FileUploadButton = () => {
  const [fileSelection, setFileSelection] = useState({});
  const [progress, setProgress] = useState(undefined);
  const [flash, setFlash] = useState(undefined);

  const uploadFileToS3 = (presignedPostData, file) => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();

      // Add presignedPostData to formData
      Object.keys(presignedPostData.fields).forEach(key => {
        // Restore hyphenated keys
        if(hyphenatedKeys[key])
        {
          formData.append(hyphenatedKeys[key], presignedPostData.fields[key]);
        } else {
          formData.append(key, presignedPostData.fields[key]);
        }
      });

      // Actual file has to be appended last.
      formData.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.onload = function() {
        if(this.status === 204){
          setProgress(undefined);
          setFlash("File uploaded successfully")
          resolve();
        }
        else
        {
          reject(this.responseText);
        }
      };

      xhr.upload.addEventListener( 'progress', (event) => {
        setProgress(Math.round(event.loaded / event.total * 100));
      });

      xhr.open("POST", presignedPostData.url, true);
      xhr.send(formData);

    });
  };


  var fileLink, progressIndicator, flashMessage;

  const openLink = async () => {
    const { data } = await getSignedUrl(fileSelection.name);
    window.open(data.getSignedUrl);
  }

  if(fileSelection.name)
    fileLink = (
      <p>
      {fileSelection.name}
      &nbsp;&nbsp;
      <button type="button" className="btn btn-link" onClick={openLink} >View</button>
    &nbsp;&nbsp;
      <DeleteButton filename={fileSelection.name} />
      </p>
    );

  if(progress)
    progressIndicator = (
      <div className="progress">
          <div
            className="progress-bar progress-bar-info progress-bar-striped"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin="0"
            aria-valuemax="100"
            style={{ width: progress + "%" }}
          >
            {progress}%
          </div>
        </div>
    );

  if(flash)
    flashMessage = (
      <div className="alert alert-primary alert-dismissible" role="alert">
      {flash}
      </div>
    );
  return (<div>
    <Files
    onSuccess={async ([selectedFile]) => {
      setFileSelection({});
      setFlash(undefined);
      setProgress(undefined);
      // Step 1 - get pre-signed POST data.
      const { data: { presignedUploadPost: presignedUploadPost } } = await getPresignedPostData(selectedFile);
      // Step 2 - upload the file to S3.
      try {
        const { file } = selectedFile.src;
        await uploadFileToS3(presignedUploadPost, file);
        console.log("File was successfully uploaded!");


        setFileSelection({name: selectedFile.name})
      } catch (e) {
        setFlash(e.message);
        console.log("An error occurred!", e.message, e.stack);
      }
    }}
    >
    {({ browseFiles }) => <button onClick={browseFiles}>Select file...</button>}
    </Files>
    <br/>
    <br/>
    {progressIndicator}
    {flashMessage}
    {fileLink}
    </div>);
};

function App() {
  return (
    <div className="container" style={{ width: "600px" }}>
    <h2>Upload a file</h2>
    <FileUploadButton />
    </div>

  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
  <ApolloProvider client={client}>
  <App />
  </ApolloProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
