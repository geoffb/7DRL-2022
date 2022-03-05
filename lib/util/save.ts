export interface ISave {
  highScore: number;
}

export function getSave(): ISave {
  const data = localStorage.getItem("save");
  if (data !== null) {
    return JSON.parse(data);
  } else {
    return {
      highScore: 0,
    };
  }
}

export function setSave(save: ISave) {
  localStorage.setItem("save", JSON.stringify(save));
}
