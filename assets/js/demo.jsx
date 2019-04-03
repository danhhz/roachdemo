// Copyright 2017 Daniel Harrison. All Rights Reserved.

class App extends React.Component {
  constructor(props) {
    super(props);
    this._postJSON = this._postJSON.bind(this);
    this.state = {
      nodes: [],
      raw: {},
    };
  };

  componentWillMount() {
    this._postJSON('noop');
  };

  _postJSON(path) {
    fetch(path, {
      method: 'POST',
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
    }).then(r => r.json())
      .then(r => {
        var nodes = Object.values(r.nodes)
          .map(n => { n.status = Node.status(n); return n })
          .sort((a, b) => parseInt(a.name) - parseInt(b.name));
        this.setState({
          nodes: nodes,
          raw: r,
        });
      })
      .catch(err => console.error(err));
  };

  render() {
    let fn = {
      addNode: () => this._postJSON('/add'),
      pauseNode: name => this._postJSON('/node/' + name + '/pause'),
      pauseAll: () => this._postJSON('/pauseall'),
      resumeNode: name => this._postJSON('/node/' + name + '/resume'),
      resumeAll: () => this._postJSON('/resumeall'),
      destroyNode: name => this._postJSON('/node/' + name + '/stop'),
      destroyAll: () => this._postJSON('/stopall'),
      startKV: () => this._postJSON('/startkv'),
      stopKV: () => this._postJSON('/stopkv'),
    }
    return (
      <div>
        <nav className='navbar navbar-default navbar-static-top' role='navigation'>
          <div className='container-fluid'>
            <div className='navbar-header'>
              <a className='navbar-brand' href='/'>CockroachDB Demo</a>
            </div>
          </div>
        </nav>

        <div className='container-fluid'>
          <Carousel fn={fn} nodes={this.state.nodes} />
          <Nodes fn={fn} nodes={this.state.nodes} raw={this.state.raw} />
        </div>
      </div>
    );
  };
};

class Nodes extends React.Component {
  render() {
    return (
      <table className='table table-bordered table-hover nodes'>
        <thead>
          <tr>
            <th width='50px'>Node</th>
            <th width='100px'>State</th>
            <th width='auto'>Admin UI</th>
            <th width='150px'>Logs</th>
            <th width='200px'>Actions</th>
          </tr>
        </thead>
        <tbody>
            {this.props.nodes.map(node => <Node fn={this.props.fn} {...node} />)}
          <tr>
            <td><button
              className='btn btn-xs btn-primary'
              onClick={this.props.fn.addNode}
            >Add Node</button></td>
            <td colSpan='4'>
              <button
                className='btn btn-xs btn-primary'
                onClick={() => this.props.fn.pauseAll() }
                disabled={this.props.nodes.some(n => n.status === 'Running') ? '' : 'disabled'}
              >Pause All</button>
              <button
                className='btn btn-xs btn-primary'
                onClick={() => this.props.fn.resumeAll() }
                disabled={this.props.nodes.some(n => n.status === 'Paused') ? '' : 'disabled'}
              >Resume All</button>
              <button
                className='btn btn-xs btn-primary'
                onClick={() => this.props.fn.destroyAll() }
                disabled={!this.props.nodes.every(n => n.status === 'Destroyed') ? '' : 'disabled'}
              >Destroy All</button>
              <button
                className='btn btn-xs btn-primary'
                onClick={() => this.props.fn.startKV() }
                disabled={this.props.raw.kv === '' ? '' : 'disabled'}
              >Start Load</button>
              <button
                className='btn btn-xs btn-primary'
                onClick={() => this.props.fn.stopKV() }
                disabled={this.props.raw.kv !== '' ? '' : 'disabled'}
              >Stop Load</button>
            </td>
          </tr>
        </tbody>
      </table>
    );
  }
};

class Node extends React.Component {
  static status(node) {
    if (node.run && node.run.Cmd && node.run.Cmd.Process && node.run.Cmd.Process.Pid > 0) {
      if (node.run.paused) {
        return 'Paused'
      }
      return 'Running'
    }
    return 'Destroyed'
  };

  static stateToClassName(state) {
    switch (state) {
    case 'Running':
      return 'success';
    case 'Paused':
      return 'warning';
    case 'Destroyed':
      return 'danger';
    }
    return '';
  };

  render() {
    return (
      <tr className={Node.stateToClassName(this.props.status)}>
        <td><a href={'/node/' + this.props.name}>{this.props.name}</a></td>
        <td>{this.props.status}</td>
        <td><a href={this.props.url} target='_blank'>{this.props.url}</a></td>
        <td>{this.props.run ? (
          <div>
            <a
              className='btn btn-xs btn-default'
              href={'/node/' + this.props.name + '/run/' + this.props.run.id + '/stdout'} target='_blank'
            ><span className='glyphicon glyphicon-file'></span> stdout</a>
            <a
              className='btn btn-xs btn-default'
              href={'/node/' + this.props.name + '/run/' + this.props.run.id + '/stderr'} target='_blank'
            ><span className='glyphicon glyphicon-file'></span> stderr</a>
          </div>
        ) : ''}</td>
        <td>
          <button
            className='btn btn-xs btn-primary'
            onClick={() => this.props.fn.pauseNode(this.props.name)}
            disabled={this.props.status === 'Running' ? '' : 'disabled'}
          >Pause</button>
          <button
            className='btn btn-xs btn-primary'
            onClick={() => this.props.fn.resumeNode(this.props.name)}
            disabled={this.props.status === 'Paused' ? '' : 'disabled'}
          >Resume</button>
          <button
            className='btn btn-xs btn-primary'
            onClick={() => this.props.fn.destroyNode(this.props.name)}
            disabled={this.props.status !== 'Destroyed' ? '' : 'disabled'}
          >Destroy</button>
        </td>
      </tr>
    );
  }
};

class Carousel extends React.Component {
  static _nodeCountValidation(nodes, min, max) {
    let filteredNodes = nodes.filter(n => n.status !== 'Destroyed');
    var ret = [];
    if (filteredNodes.length < min) { ret.push('Requires at least ' + min + ' nodes.') }
    if (filteredNodes.length >= max) { ret.push('Requires fewer than ' + max + ' nodes.') }
    return ret;
  }
  static _nodeRunningValidation(nodes, min, max) {
    let filteredNodes = nodes.filter(n => n.status === 'Running');
    var ret = [];
    if (filteredNodes.length < min) { ret.push('Requires at least ' + min + ' running nodes.') }
    if (filteredNodes.length >= max) { ret.push('Requires fewer than ' + max + ' running nodes.') }
    return ret;
  }
  static _nodePausedValidation(nodes, min, max) {
    let filteredNodes = nodes.filter(n => n.status === 'Paused');
    var ret = [];
    if (filteredNodes.length < min) { ret.push('Requires at least ' + min + ' paused nodes.') }
    if (filteredNodes.length >= max) { ret.push('Requires fewer than ' + max + ' paused nodes.') }
    return ret;
  }

  render() {
    let items = [
      {
        headline: 'Demo',
        text: [
          <p><a href='https://www.cockroachlabs.com/'>CockroachDB</a> is a cloud-native SQL database for building global, scalable cloud services that survive disasters.</p>,
          <p>This demo walks you through a simple demonstration of how CockroachDB replicates and distributes data.</p>,
        ],
        action: 'Next',
        actionFn: (nodes) => {
        },
      },
      {
        headline: 'Start up 3 nodes',
        text: [
          <p>Lorum ipsum</p>,
        ],
        actionFn: (nodes) => {
          let filteredNodes = nodes.filter(n => n.status !== 'Destroyed');
          for (var i = filteredNodes.length || 0; i < 3; i++) { this.props.fn.addNode(); }
          this.props.fn.resumeAll();
        },
        validationFns: [
          (nodes) => Carousel._nodeCountValidation(nodes, 0, undefined),
        ],
      },
      // {
      //   headline: 'Start a load generator',
      //   text: [
      //     <p>Open the Admin UI of one of your nodes and click View nodes list on the right. You'll see that all three nodes are listed. At first, the replica count will be lower for nodes 2 and 3. Very soon, the replica count will be identical across all three nodes, indicating that all data in the cluster has been replicated 3 times; there's a copy of every piece of data on each node.</p>
      //   ],
      //   actionFn: (nodes) => {
      //     this.props.fn.startKV();
      //   },
      // },
      {
        headline: 'Add two more nodes',
        text: [
          <p>Back in the Admin UI, you'll see that there are now 5 nodes listed. Again, at first, the replica count will be lower for nodes 4 and 5. But because you changed the default replication factor to 5, very soon, the replica count will be identical across all 5 nodes, indicating that all data in the cluster has been replicated 5 times.</p>
        ],
        actionFn: (nodes) => {
          let filteredNodes = nodes.filter(n => n.status !== 'Destroyed');
          for (var i = filteredNodes.length || 0; i < 5; i++) { this.props.fn.addNode(); }
          this.props.fn.resumeAll();
        },
        validationFns: [
          (nodes) => Carousel._nodeCountValidation(nodes, 3, 5),
        ],
      },
      {
        headline: 'Pause a node',
        actionFn: (nodes) => {
          let node = nodes.filter(n => n.status === 'Running')[1];
          this.props.fn.pauseNode(node.name);
        },
        validationFns: [
          (nodes) => Carousel._nodeRunningValidation(nodes, 3, undefined),
        ],
      },
      {
        headline: 'Bring it back',
        actionFn: () => {
          this.props.fn.resumeAll();
        },
        validationFns: [
          (nodes) => Carousel._nodeRunningValidation(nodes, 2, undefined),
          (nodes) => Carousel._nodePausedValidation(nodes, 1, undefined),
        ],
      },
      {
        headline: 'Kill a node',
        actionFn: (nodes) => {
          let node = nodes.filter(n => n.status === 'Running')[2];
          this.props.fn.destroyNode(node.name);
        },
        validationFns: [
          (nodes) => Carousel._nodeRunningValidation(nodes, 3, undefined),
        ],
      },
      {
        headline: 'Replace it with a new node',
        actionFn: () => {
          this.props.fn.addNode();
        },
      },
      // {
      //   headline: 'Stop the load generator',
      //   actionFn: (nodes) => {
      //     this.props.fn.stopKV();
      //   },
      // },
      {
        headline: 'All done',
        text: [
          <p>Feel free to shut down this program and remove the data it generated.</p>,
        ],
      },
    ];
    items[0].active = true;

    return (
      <div
        id='myCarousel' className='carousel slide'
        data-interval='false'
        data-wrap='false'
        >
        <ol className='carousel-indicators'>
          {items.map((item, idx) => {
            return <li data-target='#myCarousel' data-slide-to={idx} className={item.active ? 'active' : ''}></li>
          })}
        </ol>
        <div className='carousel-inner' role='listbox'>
          {items.map(item => <CarouselItem nodes={this.props.nodes} {...item} />)}
        </div>
        <a className='left carousel-control' href='#myCarousel' role='button' data-slide='prev'>
          <span className='glyphicon glyphicon-chevron-left' aria-hidden='true'></span>
          <span className='sr-only'>Previous</span>
        </a>
        <a className='right carousel-control' href='#myCarousel' role='button' data-slide='next'>
          <span className='glyphicon glyphicon-chevron-right' aria-hidden='true'></span>
          <span className='sr-only'>Next</span>
        </a>
      </div>
    );
  };
};

class CarouselItem extends React.Component {
  render() {
    var failures = [];
    (this.props.validationFns || []).forEach(fn => {
      failures = failures.concat(fn(this.props.nodes) || []);
    })
    return (
      <div className={this.props.active ? 'item active' : 'item'}>
        <div className='container'>
          <h1>{this.props.headline}</h1>
          {this.props.text}
          {failures.map(failure => (
            <div className="alert alert-info" role="alert">{failure}</div>
          ))}
          <div className='carousel-caption'>
            <p><button
              className='btn btn-lg btn-primary'
              onClick={() => {
                if (this.props.actionFn) {
                  this.props.actionFn(this.props.nodes);
                }
                $('#myCarousel').carousel('next');
              }}
              disabled={failures.length > 0 ? 'disabled' : ''}
              >{this.props.action ? this.props.action : 'Run'}</button></p>
            </div>
        </div>
      </div>
    );
  };
};

$(document).ready(function (){
  ReactDOM.render(<App />, document.getElementById('root'));
});
