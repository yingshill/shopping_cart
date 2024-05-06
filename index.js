const API = (() => {
  const URL = "http://localhost:3000";
  const getCart = () => {
    // Get cart data
    return fetch(`${URL}/cart`)
    .then(res => res.json())
    .catch(error => {
            console.log('Error fetching cart:', error);
            throw new Error('Network response was not ok');
    });
  };

  const getInventory = () => {
    // Get inventory data
    return fetch(`${URL}/inventory`)
    .then(res => res.json())
    .catch(error => {
            console.log('Error fetching inventory:', error);
            throw new Error('Network response was not okay');
    });

  };

  const addToCart = (inventoryItem) => {
    // Add an item to cart
    return fetch(`${URL}/cart`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(inventoryItem),
    }).then(res => res.json())
  };

  const updateCart = (id, newAmount) => {
    // Update an item in cart
    return fetch(`${URL}/cart/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: newAmount }),
      }).then(res => res.json());
  };

  const deleteFromCart = (id) => {
    // Delete an item in cart
    return fetch(`${URL}/cart/${id}`, {
        method: 'DELETE',
      }).then(res => res.json());
  };

  const checkout = () => {
    // you don't need to add anything here
    return getCart().then((data) =>
      Promise.all(data.map((item) => deleteFromCart(item.id)))
    );
  };

  return {
    getCart,
    updateCart,
    getInventory,
    addToCart,
    deleteFromCart,
    checkout,
  };
})();

const Model = (() => {
  class State {
    #inventory;
    #cart;
    #onChange;

    constructor() {
      this.#inventory = [];
      this.#cart = [];
      this.#onChange = () => {};
    }

    get cart() {
      return this.#cart;
    }

    get inventory() {
      return this.#inventory;
    }

    set cart(newCart) {
        this.#cart = newCart;
        this.#onChange();
    };

    set inventory(newInventory) {
        this.#inventory = newInventory;
        this.#onChange();
    };

    subscribe(cb) {
        this.#onChange = cb;
    };
  }

  const {
    getCart,
    updateCart,
    getInventory,
    addToCart,
    deleteFromCart,
    checkout,
  } = API;

  return {
    State,
    ...API,
  };
})();

const View = (() => {
  // Create UI components for displaying inventory items with "+" 
  // and "-" buttons, and a cart list with delete and checkout options

  // Render "Inventory" list
  const renderInventory = (inventory, handleAddToCart, handleUpdateAmount) => {
    const inventoryContainer = document.getElementById('inventory-wrapper');
    inventoryContainer.innerHTML = inventory.map(item => `
      <div class="item">
        <span>${item.content}</span>
        <button onclick="handleUpdateAmount('${item.id}', -1)">-</button>
        <input type="text" value="${item.amount || 0}" readonly>
        <button onclick="handleUpdateAmount('${item.id}', 1)">+</button>
        <button onclick="handleAddToCart('${item.id}', ${item.amount || 0})">Add to Cart</button>
      </div>
    `).join('');
  }

  // Render "Cart" list
  const renderCart = (cart, handleDeleteFromCart, handleCheckout) => {
    const cartContainer = document.getElementById('cart-wrapper');
    cartContainer.innerHTML = cart.map(item => `
      <div class="item">
        <span>${item.content} x ${item.amount}</span>
        <button onclick="handleDeleteFromCart('${item.id}')">Delete</button>
      </div>
    `).join('');
    cartContainer.innerHTML += `<button onclick="handleCheckout()">Checkout</button>`;
  }

  // Function to display errors
  const displayError = (message) => {
    console.error(message);
  }
  
  return {
    renderInventory,
    renderCart,
  };
})();

const Controller = ((model, view) => {
  // Link the Model and View, and handle user interactions such as adding items
  // to the cart, updating quantities, deleting items, and checking out, etc.
  const state = new model.State();

  // Subscribe to state changes to update the view
  state.subscribe(() => {
    view.renderInventory(state.inventory, handleAddToCart, handleUpdateAmount);
    view.renderCart(state.cart, handleDeleteFromCart, handleCheckout);
  });

  // Initiate the application state
  const init = async () => {
    try {
      const [inventory, cart] = await Promise.all([model.getInventory(), model.getCart()]);
      state.inventory = inventory;
      state.cart = cart;
    } catch (error) {
      view.displayError('Failed to initialize data: ' + error.message);
    }
  };

  const handleUpdateAmount = (id, delta) => {
    const item = state.inventory.find(item => item.id === id);
    if (item) {
        item.amount = (item.amount || 0) + delta;
        if (item.amount < 0) item.amount = 0;
        state.inventory = [...state.inventory];
    }
  };

  const handleAddToCart = (id, amount) => {
    const item = state.cart.find(item => item.id === id);
    if (item) {
        item.amount += amount;
    } else {
        const product = state.inventory.find(item => item.id === id);
        if (product && amount > 0) {
            state.cart = [...state.cart, {...product, amount}];
        }
    }
    model.addToCart({id, amount}).then(() => {
        model.getCart().then(data => state.cart = data);
      });
  };

  const handleDeleteFromCart = (id) => {
    state.cart = state.cart.filter(item => item.id !== id);
    model.deleteFromCart(id).then(() => {
      model.getCart().then(data => state.cart = data);
    });
  };

  const handleCheckout = () => {
    model.checkout().then(() => {
        state.cart = [];
      });
  };

  const bootstrap = () => {
    init();
  };

  return {
    bootstrap,
  };
})(Model, View);

Controller.bootstrap();
