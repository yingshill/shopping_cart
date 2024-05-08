const API = (() => {
  const URL = "http://localhost:3000";

  const fetchWithErrorHandling = async (url, options) => {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();    
    } catch (error) {
        console.error('Fetch error:', error);
        throw error; // rethrow to handle it in the calling context
    }
  };

  const getCart = () => fetchWithErrorHandling(`${URL}/cart`);
  const getInventory = () => fetchWithErrorHandling(`${URL}/inventory`);

  const addToCart = (inventoryItem) => {
    // Add an item to cart
    return fetchWithErrorHandling(`${URL}/cart`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(inventoryItem),
    });
  };

  const updateCart = (id, newAmount) => {
    // Update an item in cart
    return fetchWithErrorHandling(`${URL}/cart/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: newAmount }),
      });
  };

  const deleteFromCart = (id) => {
    // Delete an item in cart
    return fetchWithErrorHandling(`${URL}/cart/${id}`, {
        method: 'DELETE',
      });
  };

  const checkout = () => {
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
    };
    return fetchWithErrorHandling(`${URL}/checkout`, options)
        .then(() => {
            console.log('Checkout successful');
        })
        .catch(error => {
            console.error('Checkout failed:', error);
            throw new Error('Checkout process failed')
        });
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
        <button id="decrease-${item.id}">-</button>
        <input type="text" value="${item.amount || 0}" readonly>
        <button id="increase-${item.id}">+</button>
        <button id="add-${item.id}">Add to Cart</button>
      </div>
    `).join('');

    // Attach event listeners
    // Directly embedding handlers can lead to vulnerabilities similar to XXS
    // if the data is not properly sanitized, and it's easier to maintain
    inventory.forEach(item => {
        document.getElementById(`decrease-${item.id}`).addEventListener('click', () => handleUpdateAmount(item.id, -1));
        document.getElementById(`increase-${item.id}`).addEventListener('click', () => handleUpdateAmount(item.id, 1));
        document.getElementById(`add-${item.id}`).addEventListener('click', () => handleAddToCart(item.id, item.amount || 0));
    })
  }

  // Render "Cart" list
  const renderCart = (cart, handleDeleteFromCart, handleCheckout) => {
    const cartContainer = document.getElementById('cart-wrapper');
    cartContainer.innerHTML = cart.map(item => `
      <div class="item">
        <span>${item.content} x ${item.amount}</span>
        <button id="delete-${item.id}">Delete</button>
      </div>
    `).join('');
    cartContainer.innerHTML += `<button id="checkout-btn">Checkout</button>`;

    cart.forEach(item => {
        document.getElementById(`delete-${item.id}`).addEventListener('click', () => handleDeleteFromCart(item.id));
    });
    document.getElementById('checkout-btn').addEventListener('click', handleCheckout);
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
