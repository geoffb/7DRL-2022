export function getSave() {
    const data = localStorage.getItem("save");
    if (data !== null) {
        return JSON.parse(data);
    }
    else {
        return {
            highScore: 0,
        };
    }
}
export function setSave(save) {
    localStorage.setItem("save", JSON.stringify(save));
}
