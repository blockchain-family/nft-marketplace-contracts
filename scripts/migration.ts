import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Address, WalletTypes } from 'locklift';
import { FactorySource } from '../build/factorySource';

export class Migration<T extends FactorySource> {
    migrationLog: Record<string, string>;
    private readonly logPath: string;

    constructor(logPath = 'migration-log.json') {
        this.logPath = join(process.cwd(), logPath);
        this.migrationLog = {};
        this._loadMigrationLog();
    }

    reset() {
        this.migrationLog = {};
        this._saveMigrationLog();
    }

    private _loadMigrationLog = () => {
        if (existsSync(this.logPath)) {
            const data = readFileSync(this.logPath, 'utf8');
            if (data) this.migrationLog = JSON.parse(data);
        }
    };

    private _saveMigrationLog = () => {
        writeFileSync(this.logPath, JSON.stringify(this.migrationLog, null, 2));
    };

    public loadAccount = async (name: string) => {
        this._loadMigrationLog();

        if (this.migrationLog[name] !== undefined) {
            return locklift.factory.accounts.addExistingAccount({
                address: new Address(this.migrationLog[name]),
                type: WalletTypes.EverWallet,
            });
        } else {
            throw new Error(`Contract ${name} not found in the migration`);
        }
    };

    public loadContract = <ContractName extends keyof T>(
        contract: ContractName,
        name: string,
    ) => {
        this._loadMigrationLog();

        if (this.migrationLog[name] !== undefined) {
            return locklift.factory.getDeployedContract(
                contract as keyof FactorySource,
                new Address(this.migrationLog[name]),
            );
        } else {
            throw new Error(`Contract ${name} not found in the migration`);
        }
    };

    public store = <T extends { address: Address }>(
        contract: T,
        name: string,
    ): void => {
        this.migrationLog = {
            ...this.migrationLog,
            [name]: contract.address.toString(),
        };

        this._saveMigrationLog();
    };
}
