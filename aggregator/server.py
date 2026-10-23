import flwr as fl

def main():
    print("Starting Federated Aggregator (Server)...")
    
    # Configure FedAvg Strategy
    strategy = fl.server.strategy.FedAvg(
        fraction_fit=1.0,  # Train on all available clients
        fraction_evaluate=1.0,
        min_fit_clients=2,
        min_available_clients=2,
    )

    # Start the Flower server on port 8080
    fl.server.start_server(
        server_address="0.0.0.0:8080",
        config=fl.server.ServerConfig(num_rounds=10),
        strategy=strategy,
    )

if __name__ == "__main__":
    main()
