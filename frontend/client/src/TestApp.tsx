import * as React from 'react';

function TestApp() {
  return React.createElement('div', null, 
    React.createElement('h1', null, 'Test App Working!'),
    React.createElement('p', null'If you see this, React is working.')
  );
}

export default TestApp;
