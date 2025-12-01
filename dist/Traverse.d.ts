type TraverseOptionsFull = {
    debug: boolean;
    canon: {
        zone: string | undefined;
        base: string | undefined;
        name: string | undefined;
    };
};
export type TraverseOptions = Partial<TraverseOptionsFull>;
declare function Traverse(this: any, options: TraverseOptionsFull): void;
export default Traverse;
