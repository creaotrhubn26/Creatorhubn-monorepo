import * as React from 'react';
import * as ReactDOM from 'react-dom/client';

const App = () => {
  return React.createElement('div', null, 
    React.createElement('h1', null'React is working!'),
    React.createElement('p', null'This confirms React 18 is properly set up.')
  );
};

export default App;

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(React.createElement(App));
